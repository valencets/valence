import type {
  TextFieldConfig,
  TextareaFieldConfig,
  RichtextFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  DateFieldConfig,
  SlugFieldConfig,
  MediaFieldConfig,
  RelationFieldConfig,
  GroupFieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  PasswordFieldConfig,
  JsonFieldConfig,
  ColorFieldConfig,
  MultiselectFieldConfig,
  ArrayFieldConfig
} from './field-types.js'

export const field = {
  text (opts: Omit<TextFieldConfig, 'type'>): TextFieldConfig {
    return { type: 'text', ...opts }
  },

  textarea (opts: Omit<TextareaFieldConfig, 'type'>): TextareaFieldConfig {
    return { type: 'textarea', ...opts }
  },

  richtext (opts: Omit<RichtextFieldConfig, 'type'>): RichtextFieldConfig {
    return { type: 'richtext', ...opts }
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

  date (opts: Omit<DateFieldConfig, 'type'>): DateFieldConfig {
    return { type: 'date', ...opts }
  },

  slug (opts: Omit<SlugFieldConfig, 'type'>): SlugFieldConfig {
    return { type: 'slug', ...opts }
  },

  media (opts: Omit<MediaFieldConfig, 'type'>): MediaFieldConfig {
    return { type: 'media', ...opts }
  },

  relation (opts: Omit<RelationFieldConfig, 'type'>): RelationFieldConfig {
    return { type: 'relation', ...opts }
  },

  group (opts: Omit<GroupFieldConfig, 'type'>): GroupFieldConfig {
    return { type: 'group', ...opts }
  },

  email (opts: Omit<EmailFieldConfig, 'type'>): EmailFieldConfig {
    return { type: 'email', ...opts }
  },

  url (opts: Omit<UrlFieldConfig, 'type'>): UrlFieldConfig {
    return { type: 'url', ...opts }
  },

  password (opts: Omit<PasswordFieldConfig, 'type'>): PasswordFieldConfig {
    return { type: 'password', ...opts }
  },

  json (opts: Omit<JsonFieldConfig, 'type'>): JsonFieldConfig {
    return { type: 'json', ...opts }
  },

  color (opts: Omit<ColorFieldConfig, 'type'>): ColorFieldConfig {
    return { type: 'color', ...opts }
  },

  multiselect (opts: Omit<MultiselectFieldConfig, 'type'>): MultiselectFieldConfig {
    return { type: 'multiselect', ...opts }
  },

  array (opts: Omit<ArrayFieldConfig, 'type'>): ArrayFieldConfig {
    return { type: 'array', ...opts }
  }
}
