export type Column = { key: string; label: string; width?: string };

export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
  wide?: boolean;
};

export type RecordRow = { id: number; [key: string]: string | number | undefined };

export type PageDefinition = {
  path: string;
  section: string;
  title: string;
  heading: string;
  description: string;
  addLabel: string;
  actions?: string[];
  exportLabel?: string;
  dateFilter?: boolean;
  columns: Column[];
  fields: Field[];
  records: RecordRow[];
};

export const cols = (items: Array<[string, string, string?]>): Column[] =>
  items.map(([key, label, width]) => ({ key, label, width }));

export const field = (
  key: string,
  label: string,
  type: Field['type'] = 'text',
  required = true,
  options?: string[],
  wide = false,
): Field => ({ key, label, type, required, options, wide });
