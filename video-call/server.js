const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('video-call running'));
app.listen(3000, () => console.log('video-call server ready'));
