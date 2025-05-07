// server/routes/judge0.js
import express from    'express';
import axios  from   'axios';
const router = express.Router();
import dotenv from 'dotenv';
dotenv.config();


const KEY = process.env.JUDGE0_API_KEY; // Store in .env

const JUDGE0_HOST = 'judge0-ce.p.rapidapi.com';
const JUDGE0_BASE = `https://${JUDGE0_HOST}`;

const pollBulkSubmissions = async (tokens) => {
  while (true) {
    const response = await axios.get(`${JUDGE0_BASE}/submissions/batch`, {
      params: {
        tokens: tokens.join(','),
        base64_encoded: 'true',
        fields: '*',
      },
      headers: {
        'x-rapidapi-key': KEY,
        'x-rapidapi-host': JUDGE0_HOST,
      },
    });

    const results = response.data.submissions;
    const pending = results.filter(sub => sub.status.id <= 2);

    if (pending.length === 0) {
      return results.map(sub => ({
        input: sub.stdin ? Buffer.from(sub.stdin, 'base64').toString() : '',
        output: sub.stdout ? Buffer.from(sub.stdout, 'base64').toString() : '',
        expectedOutput: sub.expected_output ? Buffer.from(sub.expected_output, 'base64').toString() : '',
        error: sub.stderr ? Buffer.from(sub.stderr, 'base64').toString() : '',
        status: sub.status.description,
        status_id: sub.status.id,
        compiledOutput: sub.compile_output ? Buffer.from(sub.compile_output, 'base64').toString() : '',
        testCasePassed: sub.stdout && sub.expected_output
          ? Buffer.from(sub.stdout, 'base64').toString() === Buffer.from(sub.expected_output, 'base64').toString()
          : false,
      }));
    }

    await new Promise(res => setTimeout(res, 500));
  }
};

router.post('/execute', async (req, res) => {
  const { languageId, code, testCases } = req.body;

  const submissions = testCases.map(tc => ({
    language_id: languageId,
    source_code: Buffer.from(code).toString('base64'),
    stdin: Buffer.from(tc.input).toString('base64'),
    expected_output: Buffer.from(tc.expectedOutput).toString('base64'),
  }));

  try {
    const response = await axios.post(`${JUDGE0_BASE}/submissions/batch`, {
      submissions,
    }, {
      params: {
        base64_encoded: 'true',
        wait: 'false',
        fields: '*',
      },
      headers: {
        'x-rapidapi-key': KEY,
        'x-rapidapi-host': JUDGE0_HOST,
        'Content-Type': 'application/json',
      },
    });

    const tokens = response.data.map(sub => sub.token);
    const results = await pollBulkSubmissions(tokens);
    res.json(results);

  } catch (err) {
    console.error("Judge0 error:", err);
    res.status(500).json({ error: "Judge0 submission failed." });
  }
});

export default router;
