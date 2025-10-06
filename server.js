const express = require("express");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const app = express();
const port = 3000;

// Определяем путь в зависимости от запуска (node / pkg)
const isPkg = typeof process.pkg !== 'undefined';
const rootDir = isPkg ? path.dirname(process.execPath) : __dirname;
const publicPath = path.join(rootDir, 'public');
const indexPath = path.join(publicPath, 'index.html');

// ⚙️ Подключение к SQL Server
const config = {
  user: "sa",
  password: "Micr0!nvest!",
  server: "26.172.108.181",
  database: "hpfoods",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// --- Загрузка index.html в память ---
let INDEX_HTML_CONTENT = null;
try {
  INDEX_HTML_CONTENT = fs.readFileSync(indexPath, 'utf8');
  console.log(`✅ index.html успешно загружен из: ${indexPath}`);
} catch (error) {
  INDEX_HTML_CONTENT = `
    <h1>500 Server Error: Failed to load index.html</h1>
    <p>Не удалось прочитать файл index.html.</p>
    <p>Ожидаемый путь: <strong>${indexPath}</strong></p>
    <p>Ошибка: ${error.message}</p>
    <p>Убедитесь, что в package.json добавлена секция "pkg" с "assets": ["public/**/*"].</p>
  `;
  console.error(`❌ Ошибка чтения index.html: ${error.message}`);
}

// Обслуживаем статику (CSS, JS, картинки)
app.use('/', express.static(publicPath));

// Отдаём index.html на /
app.get('/', (req, res) => {
  if (INDEX_HTML_CONTENT.startsWith('<h1')) {
    res.status(500).send(INDEX_HTML_CONTENT);
  } else {
    res.type('text/html').send(INDEX_HTML_CONTENT);
  }
});

// 📡 API: список заказов
app.get("/orders", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query(`
      WITH OrdersOfDay AS (
        SELECT DISTINCT Acct
        FROM operations
        WHERE OperType = 2
        AND CAST(Date AS date) = CAST(GETDATE() AS date)
      )
      SELECT 
        o2.OrderOfDay,
        p.Company AS [Partner],
        g.Name AS [Good],
        CONVERT(varchar(8), o.UserRealTime, 108) AS [Time],
        CASE 
          WHEN o.OperType = 33 THEN N'Заказано'
          WHEN o.OperType = 2 THEN N'Оплачено'
          ELSE N'Неизвестно'
        END AS [Status]
      FROM operations o
      LEFT JOIN goods g ON g.ID = o.GoodID
      LEFT JOIN partners p ON p.ID = o.PartnerID
      LEFT JOIN GoodsGroups gg on g.GroupID = gg.ID
      LEFT JOIN (
        SELECT Acct, ROW_NUMBER() OVER (ORDER BY Acct ASC) AS OrderOfDay
        FROM OrdersOfDay
      ) o2 ON o.Acct = o2.Acct
      WHERE o.OperType IN (33, 2) AND gg.id in (3,4,5,6)
      AND CAST(o.Date AS date) = CAST(GETDATE() AS date)
      ORDER BY o.UserRealTime
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Ошибка SQL:", err.message);
    res.status(500).send("Ошибка сервера: " + err.message);
  }
});

// Debug-страница
app.get('/debug', (req, res) => {
  res.send(`
    <h1>Debug Information</h1>
    <p>__dirname: <strong>${__dirname}</strong></p>
    <p>rootDir: <strong>${rootDir}</strong></p>
    <p>publicPath: <strong>${publicPath}</strong></p>
    <p>index.html загружен: <strong>${INDEX_HTML_CONTENT ? 'Да' : 'Нет'}</strong></p>
    <p>Запущено как PKG: <strong>${!!process.pkg}</strong></p>
  `);
});

// Запуск сервера
app.listen(port, "0.0.0.0", () => console.log(`Сервер слушает порт ${port}`));