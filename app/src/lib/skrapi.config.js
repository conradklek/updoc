// skrapi.config.js

// Set the `apiUrl` values for each given environment. Skrapi will detect the current
// hostname with `window.location.hostname` and will then prepend all skrapi fetch calls
// with the appropriate apiUrl.
export const hosts = {
  // Local Dev
  'localhost': {
    apiUrl: 'http://localhost:3100/api/v1'
  },
  // Production
  'skrapidev.codepilot.com': {
    apiUrl: 'https://skrapidev.codepilot.com/api/v1'
  }
}

// Set deployment targets here which will be used by deploy.js (npm run deploy-<target>)
// For example, if the current git branch is `staging`, and `npm run deploy-client` is 
// invoked, `branches.staging.client` will be used for rsync deployment parameters.
export const branches = {
  main: {
    client: {
      sources: ['package.json', 'build'],
      user: 'skrapidev',
      host: 'skrapidev.codepilot.com',
      port: 5005,
      path: '/home/skrapidev/production/client/'
    },
    api: {
      sources: ['lib', 'models', 'routes', 'server.js', 'package.json'],
      user: 'skrapidev',
      host: 'skrapidev.codepilot.com',
      port: 5105,
      path: '/home/skrapidev/production/api/'
    }
  },
}