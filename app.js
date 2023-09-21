  const { Client } = require('pg');
  const express = require('express');
  const cors = require('cors');

  const app = express();
  app.use(cors());
  app.use(express.json());

  const PORT = process.env.PORT || 8080;

  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'quiz',
    password: 'ibnu161206',
    port: 5432,
  });

  async function connect() {
    try {
      await client.connect();
      console.log('Connected to the database');
    } catch (error) {
      console.error('Error connecting to the database:', error);
    }
  }

  async function init() {
    await connect();
  }

  // app.get('/api/quiz-by-category/:categoryId/1', async (req, res) => {
  //   try {
  //     console.log("dihit")
  //     const categoryId = parseInt(req.params.categoryId, 10); 
      
  //     if (isNaN(categoryId)) {
  //       res.status(400).json({ error: 'Invalid categoryId' });
  //       return;
  //     }
      
  //     const query = `
  //       SELECT *
  //       FROM quiz_kategori INNER JOIN quiz ON quiz_kategori.id = quiz.kategori_id WHERE quiz.kategori_id = $1;
  //     `;
  
  //     const { rows } = await client.query(query, [categoryId]);
  //     res.json(rows);
  //   } catch (error) {
  //     console.error('Error:', error);
  //     res.status(500).json({ error: 'Internal Server Error' });
  //   }
  // });

  app.get('/api/QuizzAnime', async (_req, res) => {
    try {
      console.log("quiz di hit");
      const quizQuery = 'SELECT * FROM quiz';
      const questionQuery = 'SELECT * FROM question';
  
      const quizResult = await client.query(quizQuery);
      const questionResult = await client.query(questionQuery);
  
      const quizzes = quizResult.rows.map((quiz) => ({
        name: quiz.name,
        questions: questionResult.rows
          .filter((question) => question.quiz_id === quiz.id)
          .map((question) => ({
            question: question.question_text,
            options: question.options,
            answer: question.answer,
          })),
      }));
  
      res.json({ data: quizzes });
    } catch (error) {
      console.log('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

  app.post('/api/scores', async (req, res) => {
    try {
      const { user_id, quiz_name, score, name } = req.body;

      const insertScoreQuery = `
        INSERT INTO scores (user_id, quiz_name, score, name)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

      const values = [user_id, quiz_name, score, name];
      const result = await client.query(insertScoreQuery, values);

      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      console.log('Error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });


  app.get('/api/leaderboard', async (_req, res) => {
    try {
      console.log("quizz di hit");
      const scoresQuery = `
        SELECT * FROM scores;
      `;

      const scoresResult = await client.query(scoresQuery);
      const scoresData = scoresResult.rows;

      res.json({ data: scoresData });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  init();