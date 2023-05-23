const fs = require('fs');
const fetch = require('isomorphic-fetch');
const { Octokit } = require('@octokit/rest');

const configData = fs.readFileSync('config.json');
const config = JSON.parse(configData);

const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  organization: config.openaiOrg,
  apiKey: config.openaiAuth,
});

const openai = new OpenAIApi(configuration);

async function getChatGPTResponse(messages) {
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: 750,
  });
  const generatedText = response.data.choices[0].message.content.trim();
  const totalTokens = response.data.usage.total_tokens;
  console.log(`Total tokens used: ${totalTokens}`);
  return generatedText;
}

async function getRepoContents(owner, repo, path) {
  const octokit = new Octokit({
    auth: config.gitAuth,
  });
  const response = await octokit.repos.getContent({
    owner: owner,
    repo: repo,
    path: path,
  });

  if (response.status !== 200) {
    throw new Error('Failed to fetch repository contents');
  }

  return response.data;
}

async function fetchGitHubRepoContents(owner, repo, path) {
    const contents = await getRepoContents(owner, repo, path);
    const fileContent = contents.content; // Get the base64-encoded content
  
    const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');

    return decodedContent;
}

async function getInput(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function chatLoop() {
  let conversation = [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  const repoOwner = config.gitOwner;
  const repoName = config.gitRepo;
  const repoPath = config.gitPath;
  const repoContents = await fetchGitHubRepoContents(repoOwner, repoName, repoPath);
  conversation.push({ role: 'assistant', content: repoContents });

  while (true) {
    const prompt = await getInput('User: ');
    if (prompt.toLowerCase() === '/quit') {
      console.log('Goodbye!');
      break;
    }
    conversation.push({ role: 'user', content: prompt });
    const response = await getChatGPTResponse(conversation);
    console.log('ChatGPT: ' + response);
    conversation.push({ role: 'assistant', content: response });
  }
}

chatLoop();
