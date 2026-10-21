/**
 * 统一内容读取入口（构建期）：从 scripts/fetch-content.mjs 生成的
 * src/generated/content.json 构造一个与 @keystatic/core/reader 等价的「假 reader」。
 *
 * 这样所有页面与组件只需把 `createReader(process.cwd(), keystaticConfig)` 换成 `makeReader()`，
 * 其余 reader.singletons.X.read() / reader.collections.X.list()/.read(slug) 的用法完全不变，
 * 彻底移除对 Keystatic / GitHub 的依赖。
 *
 * content.json 形状：{ knowledge:[{slug,data}], scenarios:[{slug,data}], singletons:{key:data} }
 */
import contentSnapshot from '../generated/content.json';

type ReaderEntry = Record<string, any>;
interface FakeReader {
  singletons: Record<string, { read: () => Promise<ReaderEntry | null> }>;
  collections: Record<string, { list: () => Promise<string[]>; read: (slug: string) => Promise<ReaderEntry | null> }>;
}

export function makeReader(): FakeReader {
  const snap = contentSnapshot as {
    knowledge: { slug: string; data: ReaderEntry }[];
    scenarios: { slug: string; data: ReaderEntry }[];
    singletons: Record<string, ReaderEntry>;
  };

  // 用 Proxy 兜底：任意未配置的单例 key（如未建 YAML 的 about）都返回「读空」reader，
  // 与 Keystatic createReader 对不存在单例返回 null 的行为一致。
  const store = snap.singletons ?? {};
  const NULL_READER = { read: async () => null };
  const singletons: FakeReader['singletons'] = new Proxy(store, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && prop in target) {
        const value = Reflect.get(target, prop, receiver) as ReaderEntry;
        return { read: async () => (value ? structuredClone(value) : null) };
      }
      return NULL_READER;
    },
  }) as FakeReader['singletons'];

  const makeCollection = (items: { slug: string; data: ReaderEntry }[]) => ({
    list: async () => items.map((i) => i.slug),
    read: async (slug: string) => {
      const hit = items.find((i) => i.slug === slug);
      return hit ? structuredClone(hit.data) : null;
    },
  });

  return {
    singletons,
    collections: {
      knowledge: makeCollection(snap.knowledge ?? []),
      scenarios: makeCollection(snap.scenarios ?? []),
    },
  };
}

export default makeReader;
