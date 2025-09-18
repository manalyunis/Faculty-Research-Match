const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`)

    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    process.on('error', (error) => {
      reject(error)
    })
  })
}

async function checkPythonAvailable() {
  const pythonCommands = ['python', 'python3', 'py']

  for (const cmd of pythonCommands) {
    try {
      await runCommand(cmd, ['--version'])
      console.log(`✅ Found Python: ${cmd}`)
      return cmd
    } catch (error) {
      console.log(`❌ ${cmd} not available`)
      continue
    }
  }

  return null
}

async function installPythonDependencies(pythonCmd) {
  const requirementsPath = path.join(__dirname, '..', 'python', 'requirements.txt')

  if (!fs.existsSync(requirementsPath)) {
    throw new Error('requirements.txt not found')
  }

  console.log('Installing Python dependencies...')

  try {
    // Try pip first
    await runCommand(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsPath])
  } catch (error) {
    console.log('pip install failed, trying with --user flag...')
    try {
      await runCommand(pythonCmd, ['-m', 'pip', 'install', '--user', '-r', requirementsPath])
    } catch (userError) {
      throw new Error(`Failed to install dependencies: ${userError.message}`)
    }
  }

  console.log('✅ Python dependencies installed successfully!')
}

async function testPythonService(pythonCmd) {
  const scriptPath = path.join(__dirname, '..', 'python', 'simple_embedding_service.py')

  return new Promise((resolve, reject) => {
    console.log('Testing Python embedding service...')

    const testProcess = spawn(pythonCmd, [scriptPath, 'test'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let stdout = ''
    let stderr = ''

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    testProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout)
          if (result.success) {
            console.log('✅ Python service test passed!')
            resolve(true)
          } else {
            console.log('❌ Python service test failed:', result.error)
            resolve(false)
          }
        } catch (parseError) {
          console.log('❌ Failed to parse test output:', stdout)
          console.log('Error output:', stderr)
          resolve(false)
        }
      } else {
        console.log(`❌ Python service test failed with code ${code}`)
        console.log('Error output:', stderr)
        resolve(false)
      }
    })

    testProcess.on('error', (error) => {
      console.log('❌ Failed to run Python service test:', error.message)
      resolve(false)
    })

    // Send empty input to close stdin
    testProcess.stdin.end()
  })
}

async function main() {
  try {
    console.log('🐍 Setting up Python environment for advanced similarity...')

    // Check if Python is available
    const pythonCmd = await checkPythonAvailable()

    if (!pythonCmd) {
      console.log('❌ Python not found!')
      console.log('Please install Python manually:')
      console.log('1. Download Python from https://www.python.org/downloads/')
      console.log('2. Or use Microsoft Store: ms-windows-store://pdp/?productid=9NRWMJP3717K')
      console.log('3. Or use winget: winget install Python.Python.3.12')
      console.log('')
      console.log('After installing Python, run this script again.')
      return false
    }

    // Install dependencies
    await installPythonDependencies(pythonCmd)

    // Test the service
    const testPassed = await testPythonService(pythonCmd)

    if (testPassed) {
      console.log('🎉 Python setup complete! Advanced similarity features are now available.')
      return true
    } else {
      console.log('⚠️  Python setup completed but service test failed.')
      console.log('The system will fall back to TF-IDF similarity.')
      return false
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    console.log('The system will continue to use TF-IDF similarity as fallback.')
    return false
  }
}

if (require.main === module) {
  main().then((success) => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { main }