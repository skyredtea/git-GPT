const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

app.get('/files', (req, res) => {
    // Handle the logic to retrieve files from GitHub API here
  });

app.get('/files', (req, res) => {
  axios
    .get('https://api.github.com/repos/your-username/your-repo/contents')
    .then(response => {
      // Handle the response from the GitHub API here
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred' });
    });
});

app.get('/', (req, res) => {
    res.send('Landing Page');
  });  

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });