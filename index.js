const express = require('express');
const fs = require('fs');
const {
  Configuration,
  OpenAIApi
} = require('openai');
const {
  Octokit
} = require('@octokit/rest');

const app = express();
const port = 3000;

const configData = fs.readFileSync('config.json');
const config = JSON.parse(configData);

const octokit = new Octokit({
  auth: config.gitAuth,
});

const configuration = new Configuration({
  organization: config.openaiOrg,
  apiKey: config.openaiAuth,
});

const openai = new OpenAIApi(configuration);

app.use(express.json());
app.use(express.static(__dirname + '/public'));
app.use(express.static('public'));

async function fetchGitHubRepoContents(octokit) {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents', {
      owner: config.gitOwner,
      repo: config.gitRepo,
    });

    const files = await Promise.all(
      response.data
      .filter(file => file.type === 'file')
      .map(async (file) => {
        const contentResponse = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: config.gitOwner,
          repo: config.gitRepo,
          path: file.path,
        });

        let content = '';
        if (contentResponse.data.content) {
          content = Buffer.from(contentResponse.data.content, 'base64').toString();
        }

        return {
          name: file.name,
          content,
        };
      })
    );
    return files;
  } catch (error) {
    throw new Error('Error fetching GitHub repository contents: ' + error.message);
  }
};

async function getChatGPTResponse(messages, maxTokens) {
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: maxTokens,
  });

  const generatedText = response.data.choices[0].message.content.trim();
  const tokensUsed = response.data.usage.total_tokens;

  return {
    generatedText,
    tokensUsed
  };
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/files', async (req, res) => {
  try {
    const files = await fetchGitHubRepoContents(octokit);
    res.json({
      files
    });
  } catch (error) {
    console.error('Error fetching GitHub repository contents:', error);
    res.status(500).json({
      message: 'Error fetching repository contents'
    });
  }
});

app.post('/chat', async (req, res) => {
  const conversation = req.body.message;
  const maxTokens = req.body.max_tokens;

  try {
    const {
      generatedText,
      tokensUsed
    } = await getChatGPTResponse(conversation, maxTokens);
    res.json({
      generatedText,
      tokensUsed
    });
  } catch (error) {
    console.error('Error in chat completion:', error);
    res.status(500).json({
      message: 'Error in chat completion'
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

console.log(`node index.js is loaded.`);