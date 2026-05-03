declare module "*.css";

declare module "html-minifier-terser" {
  export type Options = {
    caseSensitive?: boolean;
    collapseBooleanAttributes?: boolean;
    collapseInlineTagWhitespace?: boolean;
    collapseWhitespace?: boolean;
    conservativeCollapse?: boolean;
    decodeEntities?: boolean;
    minifyCSS?: boolean;
    minifyJS?: boolean;
    removeAttributeQuotes?: boolean;
    removeComments?: boolean;
  };

  export function minify(input: string, options?: Options): Promise<string>;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
