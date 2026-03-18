import type {
  TextFieldConfig,
  TextareaFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  DateFieldConfig,
  SlugFieldConfig,
  MediaFieldConfig,
  RelationFieldConfig,
  GroupFieldConfig
} from './field-types.js'

export const field = {
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
  }
}
