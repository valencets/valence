import type {
  TextFieldConfig,
  TextareaFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  MultiselectFieldConfig,
  DateFieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  ColorFieldConfig,
  SlugFieldConfig,
  JsonFieldConfig,
  ArrayFieldConfig,
  GroupFieldConfig
} from './store-field-types.js'

export const field = Object.freeze({
  text (opts: Omit<TextFieldConfig, 'type'>): TextFieldConfig {
    return { type: 'text', ...opts }
  },
  textarea (opts: Omit<TextareaFieldConfig, 'type'>): TextareaFieldConfig {
    return { type: 'textarea', ...opts }
  },
  number (opts: Omit<NumberFieldConfig, 'type'>): NumberFieldConfig {
    return { type: 'number', ...opts }
  },
  boolean (opts: Omit<BooleanFieldConfig, 'type'>): BooleanFieldConfig {
    return { type: 'boolean', ...opts }
  },
  select (opts: Omit<SelectFieldConfig, 'type'>): SelectFieldConfig {
    return { type: 'select', ...opts }
  },
  multiselect (opts: Omit<MultiselectFieldConfig, 'type'>): MultiselectFieldConfig {
    return { type: 'multiselect', ...opts }
  },
  date (opts: Omit<DateFieldConfig, 'type'>): DateFieldConfig {
    return { type: 'date', ...opts }
  },
  email (opts: Omit<EmailFieldConfig, 'type'>): EmailFieldConfig {
    return { type: 'email', ...opts }
  },
  url (opts: Omit<UrlFieldConfig, 'type'>): UrlFieldConfig {
    return { type: 'url', ...opts }
  },
  color (opts: Omit<ColorFieldConfig, 'type'>): ColorFieldConfig {
    return { type: 'color', ...opts }
  },
  slug (opts: Omit<SlugFieldConfig, 'type'>): SlugFieldConfig {
    return { type: 'slug', ...opts }
  },
  json (opts: Omit<JsonFieldConfig, 'type'>): JsonFieldConfig {
    return { type: 'json', ...opts }
  },
  array (opts: Omit<ArrayFieldConfig, 'type'>): ArrayFieldConfig {
    return { type: 'array', ...opts }
  },
  group (opts: Omit<GroupFieldConfig, 'type'>): GroupFieldConfig {
    return { type: 'group', ...opts }
  }
})
