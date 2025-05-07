import express from 'express';
import axios from 'axios';
const router = express.Router();
import dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.JUDGE0_API_KEY; // Store in .env

// Function to fetch submission status
const getSubmission = async (tokenId) => {
  const options = {
    method: 'GET',
    url: `https://judge0-ce.p.rapidapi.com/submissions/${tokenId}`,
    params: {
      base64_encoded: 'true',
      fields: '*',
    },
    headers: {
      'x-rapidapi-key': KEY,
      'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
    },
  };

  try {
    const response = await axios.request(options);
    return response.data;
  } catch (error) {
    console.error('Error fetching submission status:', error.message);
    throw new Error('Error fetching submission status');
  }
};

// POST route for code submission
router.post('/execute', async (req, res) => {
  const { id, code, stdinput } = req.body;

  // Check if required data is provided
  if (!id || !code) {
    return res.status(400).json({ error: 'Language ID and code are required' });
  }

  const options = {
    method: 'POST',
    url: 'https://judge0-ce.p.rapidapi.com/submissions',
    params: {
      base64_encoded: 'true',
      wait: 'false',
      fields: '*',
    },
    headers: {
      'x-rapidapi-key': process.env.JUDGE0_API_KEY, // API key from environment variables
      'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
      'Content-Type': 'application/json',
    },
    data: {
      language_id: id,
      source_code: Buffer.from(code).toString('base64'),
      stdin: Buffer.from(stdinput || '').toString('base64'), // Handle empty input
    },
  };

  try {
    // Submit code for execution
    const response = await axios.request(options);
    const token = response.data.token;
    console.log("Received token:", token);

    if (token) {
      let statusId = 1;
      let attempts = 0;
      const maxAttempts = 30;  // Set a max attempt limit to prevent infinite loops

      // Polling for the status of the submission
      while ((statusId === 1 || statusId === 2) && attempts < maxAttempts) {
        const result = await getSubmission(token);
        statusId = result.status_id;
        console.log(`Polling attempt: ${attempts}, Status ID: ${statusId}`);

        if (result.status.description === 'Accepted') {
          const output = result.stdout ? Buffer.from(result.stdout, 'base64').toString() : 'No output';
          return res.json({ output });
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before polling again
      }

      // If submission failed or timed out
      return res.status(500).json({ error: 'Submission failed or timed out' });
    } else {
      return res.status(500).json({ error: 'No token received from Judge0 API.' });
    }
  } catch (error) {
    console.error('Error executing code:', error.message);
    return res.status(500).json({ error: `Error executing code: ${error.message}` });
  }
});

export default router;
