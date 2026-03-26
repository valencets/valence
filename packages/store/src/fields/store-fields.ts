import type {
  TextFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  DateFieldConfig,
  JsonFieldConfig,
  ArrayFieldConfig,
  GroupFieldConfig
} from './store-field-types.js'

export const field = Object.freeze({
  text (opts: Omit<TextFieldConfig, 'type'>): TextFieldConfig {
    return { type: 'text', ...opts }
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
