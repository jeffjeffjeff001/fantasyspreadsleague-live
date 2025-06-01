import { useState } from 'react';

export default function AdminUpload() {
  const [games, setGames] = useState([{ home: '', away: '', spread: '', time: '' }]);

  const handleChange = (index, field, value) => {
    const updatedGames = [...games];
    updatedGames[index][field] = value;
    setGames(updatedGames);
  };

  const addGameRow = () => {
    setGames([...games, { home: '', away: '', spread: '', time: '' }]);
  };

  const submitGames = () => {
    console.log("Submitted games:", games);
    alert("Games submitted (console only, backend hookup pending)");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Week 1 Games</h2>
      {games.map((game, idx) => (
        <div key={idx} style={{ marginBottom: 10 }}>
          <input
            placeholder="Home Team"
            value={game.home}
            onChange={(e) => handleChange(idx, 'home', e.target.value)}
          />
          <input
            placeholder="Away Team"
            value={game.away}
            onChange={(e) => handleChange(idx, 'away', e.target.value)}
          />
          <input
            placeholder="Spread"
            value={game.spread}
            onChange={(e) => handleChange(idx, 'spread', e.target.value)}
          />
          <input
            placeholder="Kickoff Time"
            value={game.time}
            onChange={(e) => handleChange(idx, 'time', e.target.value)}
          />
        </div>
      ))}
      <button onClick={addGameRow}>Add Game</button>
      <button onClick={submitGames}>Submit</button>
    </div>
  );
}
