const { Client } = require('pg');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8081;


async function connect() {
  try {
    await client.connect();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

async function init()   {
  await connect();  
}

app.get('/api/quizCategory/:categoryId', async (req, res) => {
  try {
    console.log("dihit")
    const categoryId = parseInt(req.params.categoryId, 10); 
    
    if (isNaN(categoryId)) {
      res.status(400).json({ error: 'Invalid categoryId' });
      return;
    }
    
    const query = `
      SELECT *
      FROM quiz_kategori INNER JOIN quiz ON quiz_kategori.id = quiz.kategori_id WHERE quiz.kategori_id = $1;
    `;

    const { rows } = await client.query(query, [categoryId]);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/quizs/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    
    if (isNaN(quizId)) {
      res.status(400).json({ error: 'Invalid quizId' });
      return;
    }
    
    const query = `
      SELECT *
      FROM quiz INNER JOIN question ON quiz.id = question.quiz_id WHERE quiz.id = $1;
    `;

    const { rows } = await client.query(query, [quizId]);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/leaderboard/:leaderboardId', async (req, res) => {
  try {
    const { leaderboardId } = req.params;

    if (isNaN(leaderboardId)) {
      res.status(400).json({ error: 'Invalid leaderboardId' });
      return;
    }

    const query = `
      SELECT s.name , q.name AS quiz_name, MAX(s.score) AS score
FROM scores s
INNER JOIN quiz q ON s.quiz_id = q.id
WHERE q.kategori_id = $1
GROUP BY s.name, q.name 
order by score desc;
`; 

    const { rows } = await client.query(query, [leaderboardId]);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


  app.post('/api/scores', async (req, res) => {
    try {
      const { user_id, quiz_id, score, name } = req.body;

      const insertScoreQuery = `
        INSERT INTO scores (user_id, quiz_id, score, name)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

      const values = [user_id, quiz_id, score, name];
      const result = await client.query(insertScoreQuery, values);

      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      console.log('Error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });

  


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

init();


