// Single pass with a replacer function: values are inserted literally (`$&`, `$1` are not
// interpreted), and `{{markers}}` that appear inside inserted user text are not expanded again.
export function fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (marker, key: string) => values[key] ?? marker);
}
