const { spawn } = require('child_process');
const path = require('path');

async function testPythonService() {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '..', 'python', 'simple_embedding_service.py');

    console.log('Testing Python embedding service integration...');

    const pythonProcess = spawn('python', [`"${pythonPath}"`, 'test'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('✅ Python service test result:', result);
          resolve(result.success);
        } catch (parseError) {
          console.log('❌ Failed to parse output:', stdout);
          console.log('Error:', stderr);
          resolve(false);
        }
      } else {
        console.log(`❌ Python process failed with code ${code}`);
        console.log('Error:', stderr);
        resolve(false);
      }
    });

    pythonProcess.on('error', (error) => {
      console.log('❌ Failed to start Python process:', error.message);
      resolve(false);
    });

    pythonProcess.stdin.end();
  });
}

async function testEmbeddingGeneration() {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '..', 'python', 'simple_embedding_service.py');

    console.log('Testing embedding generation...');

    const testData = {
      texts: ['computer science machine learning', 'electrical engineering power systems']
    };

    const pythonProcess = spawn('python', [`"${pythonPath}"`, 'generate_embeddings'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('✅ Embedding generation result:', {
            success: result.success,
            embeddingCount: result.embeddings ? result.embeddings.length : 0,
            embeddingDimension: result.embeddings && result.embeddings[0] ? result.embeddings[0].length : 0
          });
          resolve(result.success);
        } catch (parseError) {
          console.log('❌ Failed to parse output:', stdout);
          console.log('Error:', stderr);
          resolve(false);
        }
      } else {
        console.log(`❌ Python process failed with code ${code}`);
        console.log('Error:', stderr);
        resolve(false);
      }
    });

    pythonProcess.on('error', (error) => {
      console.log('❌ Failed to start Python process:', error.message);
      resolve(false);
    });

    pythonProcess.stdin.write(JSON.stringify(testData));
    pythonProcess.stdin.end();
  });
}

async function main() {
  console.log('🐍 Testing Python integration...\n');

  const serviceTest = await testPythonService();
  if (!serviceTest) {
    console.log('❌ Python service test failed');
    return false;
  }

  const embeddingTest = await testEmbeddingGeneration();
  if (!embeddingTest) {
    console.log('❌ Embedding generation test failed');
    return false;
  }

  console.log('\n🎉 All Python integration tests passed!');
  return true;
}

main().then((success) => {
  process.exit(success ? 0 : 1);
});