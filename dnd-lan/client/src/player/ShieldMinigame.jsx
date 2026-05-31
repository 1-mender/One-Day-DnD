import React from 'react';
import { MINIGAMES } from '../dm/dmPlayersDomain';

// Сюда должен приходить ID игры, которую включил мастер (например, "pc" или "shield")
export const MinigameWindow = ({ activeMinigameId }) => {
  // Находим данные игры в нашем списке
  const gameInfo = MINIGAMES.find(game => game.id === activeMinigameId);

  // Если игра не найдена или выключена, ничего не показываем
  if (!gameInfo) return null;

  return (
    <div className="minigame-overlay">
      <div className="minigame-header">
        <strong>{gameInfo.label} открыт мастером</strong>
      </div>
      
      {/* 
        Сам "движок" мини-игры. Iframe просто открывает HTML файл. 
        gameInfo.folder подставит правильное имя папки.
      */}
      <iframe 
        src={`/minigames/${gameInfo.folder}/index.html`} 
        title={gameInfo.label}
        style={{ width: '100%', height: '80vh', border: 'none' }}
      ></iframe>
    </div>
  );
};