
fetch('https://api.genelpara.com/embed/borsa.json')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
