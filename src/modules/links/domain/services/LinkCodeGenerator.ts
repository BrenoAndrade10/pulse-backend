export const LINK_CODE_GENERATOR = Symbol('LINK_CODE_GENERATOR');

export interface LinkCodeGenerator {
  generate(length?: number): string;
}
