const express = require('express');
const fs = require('fs');
const configData = fs.readFileSync('config.json');
const config = JSON.parse(configData);
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = 3000;

const {
    Octokit
} = require('@octokit/rest');

const octokit = new Octokit({
    auth: config.gitAuth,
});


app.use(express.json());

const configuration = new Configuration({
    organization: config.organization,
    apiKey: config.openaiAuth,
});

const fetchGitHubRepoContents = async (octokit) => {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents', {
            owner: config.gitOwner,
            repo: config.gitRepo,
        });

        const files = await Promise.all(
            response.data
            .filter(file => file.type === 'file') // Add this line to filter out non-file types
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

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/files', async (req, res) => {
    try {
        const files = await fetchGitHubRepoContents(octokit); // Pass the octokit instance as an argument
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

app.use(express.static(__dirname + '/public'));

const openai = new OpenAIApi(configuration);

async function getChatGPTResponse(messages) {
    const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 750,
    });

    const generatedText = response.data.choices[0].message.content.trim();
    return generatedText;
}

app.post('/chat', async (req, res) => {
    const conversation = req.body.message;
    const maxTokens = req.body.max_tokens;

    const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: conversation,
        max_tokens: maxTokens,
    });

    const generatedText = response.data.choices[0].message.content.trim();
    const tokensUsed = response.data.usage.total_tokens;

    res.json({
        generatedText,
        tokensUsed
    }); // send used tokens back to the client
});

app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

console.log(`node index.js is loaded.`);