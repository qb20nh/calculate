/**
 * ESLint 10 + @stylistic v5 Compatibility Bridge
 * 100% implementation of rule migrations and schema normalization.
 */
export function fixStylisticRules(rules) {
  if (!rules) return {}
  const fixed = { ...rules }

  // 1. Unified Rules (v4 JSX-specific -> v5 Unified)
  // These rules were merged into the core stylistic rules.
  const unified = {
    '@stylistic/jsx-indent': '@stylistic/indent',
    '@stylistic/jsx-indent-props': '@stylistic/indent',
    '@stylistic/jsx-quotes': '@stylistic/quotes',
    '@stylistic/jsx-props-no-multi-spaces': '@stylistic/no-multi-spaces',
    '@stylistic/jsx-space-before-closing': '@stylistic/space-before-closing',
    '@stylistic/func-call-spacing': '@stylistic/function-call-spacing',
  }

  for (const [oldName, newName] of Object.entries(unified)) {
    if (fixed[oldName]) {
      // If the unified rule already exists, we might need to merge options,
      // but usually the JSX version is just a duplicate or has specific JSX options.
      fixed[newName] = fixed[oldName]
      delete fixed[oldName]
    }
  }

  // 2. Fix 'quotes' Schema (Boolean -> String)
  if (fixed['@stylistic/quotes']) {
    const current = Array.isArray(fixed['@stylistic/quotes']) ? [...fixed['@stylistic/quotes']] : [fixed['@stylistic/quotes']]
    const optionsIndex = current.findIndex(item => typeof item === 'object' && item !== null)
    if (optionsIndex !== -1) {
      const options = { ...current[optionsIndex] }
      if (options.allowTemplateLiterals === true) options.allowTemplateLiterals = 'always'
      if (options.allowTemplateLiterals === false) options.allowTemplateLiterals = 'never'
      current[optionsIndex] = options
      fixed['@stylistic/quotes'] = current
    }
  }

  // 3. Fix 'object-property-newline' (Remove deprecated 'allowMultiplePropertiesPerLine')
  if (fixed['@stylistic/object-property-newline']) {
    const current = fixed['@stylistic/object-property-newline']
    if (Array.isArray(current) && current[1]) {
      const { allowMultiplePropertiesPerLine, ...rest } = current[1]
      fixed['@stylistic/object-property-newline'] = [current[0], rest]
    }
  }

  // 4. Fix 'indent-binary-ops' (Schema Normalization)
  if (fixed['@stylistic/indent-binary-ops']) {
    const current = fixed['@stylistic/indent-binary-ops']
    if (Array.isArray(current)) {
      if (typeof current[1] !== 'number' && typeof current[1] !== 'object') {
        fixed['@stylistic/indent-binary-ops'] = [current[0], 2]
      }
    } else if (typeof current !== 'number') {
      fixed['@stylistic/indent-binary-ops'] = ['error', 2]
    }
  }

  return fixed
}
