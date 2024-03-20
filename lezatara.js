const { Client } = require("pg");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");


const upload = multer({
  storage: multer.diskStorage({
    destination: "./public/uploads/",
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;


async function connect() {
  try {
    await client.connect();
    console.log("Connected to the database");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

async function init() {
  await connect();
} 

async function logActivity(userId, activity) {
  const logQuery = `
    INSERT INTO log (id_user, activity, created_at)
    VALUES ($1, $2, NOW())
    RETURNING *;
  `;

  const logValues = [userId, activity];
  await client.query(logQuery, logValues);
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Query ke database
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      console.log('Stored Password:', user.password); // Tambahkan ini untuk melihat password yang disimpan di database

      // Memeriksa kecocokan password
      const passwordMatch = password === user.password;

      console.log('Password Match:', passwordMatch); // Tambahkan ini untuk melihat hasil pembandingan password

      if (passwordMatch) {
        await logActivity(user.id, 'User login');
        res.json({ success: true, user: { username: user.username, nama: user.nama, role: user.role } });
      } else {
        res.json({ success: false, message: 'Password salah.' });
      }
    } else {
      res.json({ success: false, message: 'Username tidak ditemukan.' });
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    res.json({ success: false, message: 'Terjadi kesalahan.' });
  }
});


// untuk owner
app.get("/api/datatransactions", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate startDate and endDate format if necessary

    let query = `
      SELECT transactions.*, products.nama_produk
      FROM transactions
      JOIN transaction_products ON transactions.id = transaction_products.id_transaksi
      JOIN products ON transaction_products.id_produk = products.id
    `;


    if (startDate && endDate) {
      query += `
        WHERE transactions.created_at BETWEEN TO_TIMESTAMP($1, 'MM/DD/YYYY') AND TO_TIMESTAMP($2, 'MM/DD/YYYY')
      `;
    }

    const queryParams = startDate && endDate ? [startDate, endDate] : [];

    const { rows } = await client.query(query, queryParams);
    res.json(rows);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/datalog", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT log.id, log.id_user, log.activity, log.created_at, users.username, users.nama
      FROM log
      JOIN users ON log.id_user = users.id
    `;

    if (startDate && endDate) {
      query += `
        WHERE log.created_at BETWEEN TO_TIMESTAMP($1, 'MM/DD/YYYY') AND TO_TIMESTAMP($2, 'MM/DD/YYYY')
      `;
    }

    const queryParams = startDate && endDate ? [startDate, endDate] : [];

    const { rows } = await client.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/datalog", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;


    let query = `
      SELECT log.id, log.id_user, log.activity, log.created_at, users.username, users.nama
      FROM log
      JOIN users ON log.id_user = users.id;
    `;

    if (startDate && endDate) {
      query += `
        WHERE log.created_at BETWEEN TO_TIMESTAMP($1, 'MM/DD/YYYY') AND TO_TIMESTAMP($2, 'MM/DD/YYYY')
      `;
    }

    const queryParams = startDate && endDate ? [startDate, endDate] : [];


    const { rows } = await client.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// untuk kasir

app.put('/reduce-stock', async (req, res) => {
  const productIds = req.body.productIds; // Ambil array ID dari body
  const { quantity } = req.body;

  try {
    // Mengurangi stok di database untuk setiap ID dalam array
    const results = await Promise.all(
      productIds.map(async (productId) => {
        const result = await client.query(
          'UPDATE products SET stok = stok - $1 WHERE id = $2 RETURNING *',
          [quantity, productId]
        );

        return result.rows[0];
      })
    );

    // Mengirim data produk yang telah diupdate
    res.json(results);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengurangi stok' });
  }
});



app.post("/api/transactions", async (req, res) => {
  try {

    if (
      !req.body.products ||   
      !req.body.nama_pelanggan ||
      !req.body.uang_bayar ||
      !req.body.uang_kembali
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Incomplete data provided.",
      });
    }

    const { products, nama_pelanggan, uang_bayar, uang_kembali } = req.body;

    await client.query("BEGIN");

    const nomor_unik = generateRandomNumber();

    const insertTransactionQuery = `
      INSERT INTO transactions (nama_pelanggan, nomor_unik, uang_bayar, uang_kembali)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;

    const transactionValues = [nama_pelanggan, nomor_unik, uang_bayar, uang_kembali];
    const transactionResult = await client.query(insertTransactionQuery, transactionValues);
    const transactionId = transactionResult.rows[0].id;

    const insertProductsQuery = `
      INSERT INTO transaction_products (id_transaksi, id_produk)
      VALUES ($1, $2);
    `;

    for (const productId of products) {
      const productValues = [transactionId, productId];
      await client.query(insertProductsQuery, productValues);
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Transaction added successfully.",
      transactionId: transactionId,
    });
  } catch (error) {
    console.error("Error:", error);
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

function generateRandomNumber() {
  // Replace this with your logic to generate a random number
  return Math.floor(Math.random() * 1000000) + 1;
}


// untuk admin

app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    if (
      !req.body.nama_produk ||
      !req.body.harga_produk ||
      !req.body.stok ||
      !req.body.deskripsi
    ) {
      return res
        .status(400)
        .json({ error: "Bad Request", message: "Incomplete data provided." });
    }

    const { nama_produk, harga_produk, stok, deskripsi } = req.body;

    const insertProductQuery = `
      INSERT INTO products (nama_produk, harga_produk, stok, deskripsi, image)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    // Check if the uploaded file has an extension

    const values = [
      nama_produk,
      harga_produk,
      stok,
      deskripsi,
      req.file.filename,
    ];
    const result = await client.query(insertProductQuery, values);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.post("/api/user", async (req, res) => {
  try {
    if (
      !req.body.username ||
      !req.body.password ||
      !req.body.nama ||
      !req.body.role
    ) {
      return res
        .status(400)
        .json({ error: "Bad Request", message: "Incomplete data provided." });
    }

    const { username, password, nama, role } = req.body;

    const insertUserQuery = `
      INSERT INTO users (username, password, nama, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [username, password, nama, role];
    const result = await client.query(insertUserQuery, values);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.put("/api/updateuser/:id", async (req, res) => {
  const usertId = req.params.id;
  const updatedData = req.body;

  try {
    // Lakukan update di database
    const result = await client.query(
      "UPDATE users SET username = $1, password = $2, nama = $3, role = $4, updated_at = NOW() WHERE id = $5 RETURNING *",
      [
        updatedData.username,
        updatedData.password,
        updatedData.nama,
        updatedData.role,
        usertId,
      ]
    );

    if (result.rows.length > 0) {
      res.status(200).json({
        message: "Data produk berhasil diperbarui",
        data: result.rows[0],
      });
    } else {
      res.status(404).json({ message: "Produk tidak ditemukan" });
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat mengupdate produk" });
  }
});

app.get("/api/dataproducts", async (req, res) => {
  try {
    const query = `
      SELECT * 
      FROM products;
    `;

    const { rows } = await client.query(query);

    // Modify each image property in the rows array
    const productsWithFullImageUrl = rows.map((product) => {
      return {
        ...product,
        image: "http://localhost:8080/uploads/" + product.image,
      };
    });

    res.json(productsWithFullImageUrl);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/api/datausers", async (req, res) => {
  try {
    const query = `
      SELECT * 
      FROM users;
    `;

    const { rows } = await client.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.delete("/api/deleteusers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleteUserQuery = `
      DELETE FROM users
      WHERE id = $1
      RETURNING *;
    `;

    const result = await client.query(deleteUserQuery, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "Product not found." });
    }

    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.put("/api/updateproduct/:id", upload.single("image"), async (req, res) => {
  console.log(req);
  const productId = req.params.id;
  const updatedData = req.body;
  const image = req.file;

  try {
    // Check if the product exists
    const checkProductQuery = "SELECT * FROM products WHERE id = $1";
    const checkResult = await client.query(checkProductQuery, [productId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    // Prepare the update query based on whether there is a new image or not
    let updateProductQuery;
    let values;

    if (image) {
      updatedData.image = image.filename;
    }

    if (image) {
      updateProductQuery = `
        UPDATE products
        SET nama_produk = $1, harga_produk = $2, stok = $3, deskripsi = $4, image = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      values = [
        updatedData.nama_produk,
        updatedData.harga_produk,
        updatedData.stok,
        updatedData.deskripsi,
        image.filename,
        productId,
      ];
    } else {
      updateProductQuery = `
        UPDATE products
        SET nama_produk = $1, harga_produk = $2, stok = $3, deskripsi = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *;
      `;
      values = [
        updatedData.nama_produk,
        updatedData.harga_produk,
        updatedData.stok,
        updatedData.deskripsi,
        productId,
      ];
    }

    // Perform the update in the database
    const result = await client.query(updateProductQuery, values);

    if (result.rows.length > 0) {
      
      res.status(200).json({
        message: "Data produk berhasil diperbarui",
        data: result.rows[0],
      });
    } else {
      res.status(404).json({ message: "Produk tidak ditemukan" });
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat mengupdate produk" });
  }
});

app.delete("/api/deleteproducts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleteProductQuery = `
      DELETE FROM products
      WHERE id = $1
      RETURNING *;
    `;

    const result = await client.query(deleteProductQuery, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "Product not found." });
    }

    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

init();
