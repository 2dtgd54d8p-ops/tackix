import type { APIRoute } from 'astro';

// 这是一个服务端接口（Cloudflare Pages Functions），不是静态页。
// 依赖：Cloudflare Pages → Settings → Functions 里把 D1 绑定到变量名 **DB**。
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Row = { name: string; email: string; message: string };

/**
 * 可选：邮件通知（Resend）。
 * 只有配置了 RESEND_API_KEY + CONTACT_NOTIFY_TO 才会发；没配置就静默跳过，
 * 保证「留言入库」这个主流程永远不受邮件服务影响。
 */
async function notifyByEmail(env: any, row: Row) {
  const apiKey = env?.RESEND_API_KEY;
  const to = env?.CONTACT_NOTIFY_TO;
  if (!apiKey || !to) return { sent: false, reason: '未配置 RESEND_API_KEY / CONTACT_NOTIFY_TO' };

  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env?.RESEND_FROM || 'onboarding@resend.dev',
        to: [to],
        subject: `[tackix] 新留言：${row.name}`,
        text: `姓名：${row.name}\n邮箱：${row.email}\n时间：${time}\n\n${row.message}`,
      }),
    });
    if (!res.ok) {
      return { sent: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error)?.message ?? '发信异常' };
  }
}

/**
 * 可选：群机器人通知（企业微信 / 飞书 / 钉钉）。
 * 只需要一个 webhook URL，自动按域名识别平台、构造对应 payload：
 *   - 企业微信 qyapi.weixin.qq.com     -> { msgtype:'text', text:{content} }
 *   - 飞书   *.feishu.cn / larksuite  -> { msg_type:'text', content:{text} }
 *   - 钉钉   oapi.dingtalk.com         -> { msgtype:'text', text:{content} }
 * 各平台机器人安全设置里建议用「自定义关键词：tackix」，否则可能被拦截。
 * 未配置 NOTIFY_WEBHOOK_URL 时静默跳过。消息永远带 [tackix] 前缀便于关键词匹配。
 */
async function notifyWebhook(env: any, row: Row) {
  const url = env?.NOTIFY_WEBHOOK_URL;
  if (!url) return { sent: false, reason: '未配置 NOTIFY_WEBHOOK_URL' };

  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const text =
    `[tackix] 新留言\n` +
    `姓名：${row.name}\n邮箱：${row.email}\n时间：${time}\n\n${row.message}`;

  let payload: any;
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    return { sent: false, reason: 'NOTIFY_WEBHOOK_URL 不是合法 URL' };
  }
  if (host.includes('qyapi.weixin.qq.com')) {
    payload = { msgtype: 'text', text: { content: text } };
  } else if (host.includes('feishu') || host.includes('larksuite')) {
    payload = { msg_type: 'text', content: { text } };
  } else if (host.includes('dingtalk')) {
    payload = { msgtype: 'text', text: { content: text } };
  } else {
    // 默认按飞书格式尝试（最常见）
    payload = { msg_type: 'text', content: { text } };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const respText = await res.text();
    if (!res.ok) {
      return { sent: false, reason: `Webhook ${res.status}: ${respText.slice(0, 200)}` };
    }
    return { sent: true, platform: host, detail: respText.slice(0, 100) };
  } catch (e) {
    return { sent: false, reason: (e as Error)?.message ?? '请求异常' };
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const row: Row = {
      name: String(body?.name ?? '').trim(),
      email: String(body?.email ?? '').trim(),
      message: String(body?.message ?? '').trim(),
    };

    if (!row.name || !row.email || !row.message) {
      return json({ ok: false, error: '姓名、邮箱、留言均为必填' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      return json({ ok: false, error: '邮箱格式不正确' }, 400);
    }
    if (row.message.length > 2000) {
      return json({ ok: false, error: '留言过长（最多 2000 字）' }, 400);
    }

    // Cloudflare runtime：locals.runtime.env 里挂着 Pages Functions 的绑定
    const rawEnv = (locals as any)?.runtime?.env ?? (locals as any)?.env;
    // 统一 trim 字符串型环境变量：Cloudflare 控制台粘贴的值末尾偶发不可见空格/换行，
    // 会导致 Key 校验失败或 Webhook URL 非法，这里做一层容错。
    const env = rawEnv
      ? new Proxy(rawEnv, {
          get: (target, key) => {
            const v = (target as any)[key];
            return typeof v === 'string' ? v.trim() : v;
          },
        })
      : rawEnv;
    const db = env?.DB;
    if (!db) {
      return json(
        { ok: false, error: '服务端尚未绑定 D1（缺少 DB 变量）。见 d1-schema.sql 顶部说明。' },
        500
      );
    }

    await db
      .prepare('INSERT INTO submissions (name, email, message, created_at) VALUES (?, ?, ?, ?)')
      .bind(row.name, row.email, row.message, new Date().toISOString())
      .run();

    // 入库成功之后再尝试通知；任意渠道失败都不影响提交结果
    const notify: Record<string, unknown> = {
      // 诊断：直接暴露每个变量是否真的到达了运行时（便于排查环境变量未注入）
      diag: {
        hasWebhook: !!env?.NOTIFY_WEBHOOK_URL,
        hasResendKey: !!env?.RESEND_API_KEY,
        hasResendTo: !!env?.CONTACT_NOTIFY_TO,
      },
    };
    if (env?.NOTIFY_WEBHOOK_URL) {
      notify.webhook = await notifyWebhook(env, row);
    }
    if (env?.RESEND_API_KEY && env?.CONTACT_NOTIFY_TO) {
      notify.email = await notifyByEmail(env, row);
    }
    if (!env?.NOTIFY_WEBHOOK_URL && !(env?.RESEND_API_KEY && env?.CONTACT_NOTIFY_TO)) {
      notify.note = '未配置任何通知渠道（NOTIFY_WEBHOOK_URL 或 RESEND_*）';
    }

    return json({ ok: true, notify }, 200);
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message ?? '服务端错误' }, 500);
  }
};
