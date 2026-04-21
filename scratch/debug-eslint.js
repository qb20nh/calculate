import config from '../eslint.config.js'

try {
  console.log('Config loaded successfully')
  // console.log(JSON.stringify(config, null, 2));
  config.forEach((c, i) => {
    console.log(`Block ${i}: plugins=${c.plugins ? Object.keys(c.plugins) : 'none'} files=${c.files || 'all'}`)
  })
} catch (e) {
  console.error('Error loading config:', e)
}
