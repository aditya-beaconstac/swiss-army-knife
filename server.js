const express = require('express');
const path = require('path');
const app = express();

console.log(path.join(__dirname, 'dist/swiss-army-knife'));
app.use(express.static(path.join(__dirname, 'dist/swiss-army-knife')));

const serveSpa = (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/swiss-army-knife/index.html'));
};

app.get('/', serveSpa);
app.get(/.*/, serveSpa);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
