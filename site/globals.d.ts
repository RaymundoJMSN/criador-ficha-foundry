declare module "handlebars/dist/handlebars.min.js" {
  const Handlebars: {
    compile(src: string): HandlebarsTemplateDelegate;
    registerHelper(nome: string, fn: (...a: unknown[]) => unknown): void;
  };
  export default Handlebars;
}
type HandlebarsTemplateDelegate = (ctx: unknown) => string;
