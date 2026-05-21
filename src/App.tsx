import { useState, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AvatarCreator, getRandomAvatar, DEFAULT_AVATAR, AvatarSVG } from './components/AvatarCreator';
import type { AvatarConfig } from './components/AvatarCreator';
import { GameTable } from './components/GameTable';
import { checkCombination, dealCards, getBotPlay, contains3Diamonds } from './utils/gameLogic';
import type { Card, Combination } from './utils/gameLogic';
import { sfx } from './utils/audio';

type Screen = 'menu' | 'lobby' | 'table';

interface Player {
  id: string;
  name: string;
  avatar: AvatarConfig;
  isHost: boolean;
  isBot: boolean;
  cards: (Card | null)[];
  passed: boolean;
  score: number;
  lastPlay: Card[] | null;
  roundPoints?: number;
  isReady: boolean;
  finishRank?: number;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: string;
  system: boolean;
}

interface RoomRules {
  pointsToWin: number;
  turnDuration: number;
  enableBombsSingle: boolean;
  enableBombsPair: boolean;
}

const INDONESIAN_NAMES = ['Aris', 'Budi', 'Candra', 'Dewi', 'Eko', 'Fitri', 'Giri', 'Hadi', 'Indra', 'Joko', 'Kartika', 'Laras', 'Mega', 'Nugroho', 'Putri', 'Rian', 'Siti', 'Taufik', 'Utami', 'Wulan'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState<string>('');
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [serverUrl, setServerUrl] = useState<string>(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  const [customServerVisible, setCustomServerVisible] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Game State
  const [isSinglePlayer, setIsSinglePlayer] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [activePlay, setActivePlay] = useState<Combination | null>(null);
  const [lastPlayerPlayedId, setLastPlayerPlayedId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'roundover' | 'gameover'>('lobby');
  const [rules, setRules] = useState<RoomRules>({
    pointsToWin: 15,
    turnDuration: 30,
    enableBombsSingle: true,
    enableBombsPair: true,
  });

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [socketId, setSocketId] = useState<string>('');
  const isChatOpenRef = useRef<boolean>(false);
  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatOpen]);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const botTimerRef = useRef<any>(null);
  const stateRef = useRef({ players, turnIndex, activePlay, lastPlayerPlayedId, gameState, rules });

  // Update state ref for bot loop
  useEffect(() => {
    stateRef.current = { players, turnIndex, activePlay, lastPlayerPlayedId, gameState, rules };
  }, [players, turnIndex, activePlay, lastPlayerPlayedId, gameState, rules]);

  // Set random player name on mount
  useEffect(() => {
    const randName = INDONESIAN_NAMES[Math.floor(Math.random() * INDONESIAN_NAMES.length)];
    setPlayerName(randName);
    setAvatar(getRandomAvatar());

    // Check query params if we were invited via a URL (e.g. /?room=ABCD)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomCodeInput(roomParam.toUpperCase());
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // ==================== Socket.io Handlers ====================
  const initSocket = () => {
    if (socketRef.current) socketRef.current.disconnect();

    // Check if we are in local dev, otherwise fallback to local port
    const finalUrl = serverUrl || 'http://localhost:3001';
    const socket = io(finalUrl, {
      reconnectionAttempts: 3,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketId(socket.id || '');
    });

    socket.on('disconnect', () => {
      setSocketId('');
    });

    if (socket.connected) {
      setSocketId(socket.id || '');
    }

    socket.on('connect_error', () => {
      setErrorMsg('Failed to connect to multiplayer server. Make sure it is running.');
    });

    socket.on('room-created', ({ roomCode, room }) => {
      setRoomCode(roomCode);
      setPlayers(room.players);
      setRules(room.rules);
      setGameState(room.gameState);
      setScreen('lobby');
      setErrorMsg('');
    });

    socket.on('room-updated', (room) => {
      setPlayers(room.players);
      setRules(room.rules);
      setGameState(room.gameState);
    });

    socket.on('join-error', (msg) => {
      setErrorMsg(msg);
      socket.disconnect();
    });

    socket.on('start-error', (msg) => {
      setErrorMsg(msg);
    });

    socket.on('game-started', (room) => {
      sfx.playDeal();
      setPlayers(room.players);
      setTurnIndex(room.turnIndex);
      setActivePlay(room.activePlay);
      setLastPlayerPlayedId(room.lastPlayerPlayedId);
      setRules(room.rules);
      setGameState(room.gameState);
      setScreen('table');
    });

    socket.on('game-updated', (room) => {
      setPlayers(room.players);
      setTurnIndex(room.turnIndex);
      setActivePlay(room.activePlay);
      setLastPlayerPlayedId(room.lastPlayerPlayedId);
      setGameState(room.gameState);
    });

    socket.on('round-over', (room) => {
      setPlayers(room.players);
      setGameState(room.gameState);
    });

    socket.on('game-aborted', (msg) => {
      setErrorMsg(msg);
      setScreen('lobby');
      setGameState('lobby');
    });

    socket.on('kicked', () => {
      setErrorMsg('You have been removed from the room.');
      setScreen('menu');
      socket.disconnect();
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      if (!isChatOpenRef.current) {
        setUnreadChatCount(prev => prev + 1);
      }
    });

    // Host bot coordinator listener
    socket.on('bot-coordinator-sync', (room) => {
      triggerBotLogicForMultiplayer(room);
    });
  };

  const createOnlineRoom = () => {
    if (!playerName.trim()) {
      setErrorMsg('Player name cannot be empty.');
      return;
    }
    setChatMessages([]);
    setIsChatOpen(false);
    setUnreadChatCount(0);
    setIsSinglePlayer(false);
    initSocket();
    socketRef.current?.emit('create-room', { playerName, avatar });
  };

  const joinOnlineRoom = () => {
    if (!playerName.trim()) {
      setErrorMsg('Player name cannot be empty.');
      return;
    }
    if (!roomCodeInput.trim()) {
      setErrorMsg('Room code cannot be empty.');
      return;
    }
    setChatMessages([]);
    setIsChatOpen(false);
    setUnreadChatCount(0);
    setIsSinglePlayer(false);
    initSocket();
    socketRef.current?.emit('join-room', {
      roomCode: roomCodeInput.toUpperCase(),
      playerName,
      avatar,
    });
    setRoomCode(roomCodeInput.toUpperCase());
    setScreen('lobby');
  };

  const toggleReadyOnline = () => {
    socketRef.current?.emit('toggle-ready', { roomCode });
  };

  const addBotOnline = () => {
    socketRef.current?.emit('add-bot', { roomCode });
  };

  const kickPlayerOnline = (playerId: string) => {
    socketRef.current?.emit('kick-player', { roomCode, playerId });
  };

  const updateRulesOnline = (newRules: RoomRules) => {
    socketRef.current?.emit('update-rules', { roomCode, rules: newRules });
  };

  const startOnlineGame = () => {
    socketRef.current?.emit('start-game', { roomCode });
  };

  const playCardsOnline = (cards: Card[]) => {
    const combo = checkCombination(cards);
    socketRef.current?.emit('play-cards', { roomCode, cards, comboType: combo.type });
  };

  const passTurnOnline = () => {
    socketRef.current?.emit('pass-turn', { roomCode });
  };

  const restartOnlineGame = () => {
    socketRef.current?.emit('restart-game', { roomCode });
  };

  // Host Bot logic orchestrator for multiplayer
  const triggerBotLogicForMultiplayer = (roomState: any) => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    const { players: rPlayers, turnIndex: rTurnIdx, gameState: rGameSt } = roomState;
    if (rGameSt !== 'playing') return;

    const currentPlayer = rPlayers[rTurnIdx];
    if (currentPlayer && currentPlayer.isBot) {
      botTimerRef.current = setTimeout(() => {
        // Run bot logic on the host client
        const hand = currentPlayer.cards.filter((c: any) => c !== null);
        const prevPlay = roomState.activePlay;
        const isFirstPlay = rPlayers.every((p: any) => p.cards.length === 13) && !prevPlay;
        const botPlay = getBotPlay(hand, prevPlay, isFirstPlay, {
          enableBombsSingle: roomState.rules.enableBombsSingle,
          enableBombsPair: roomState.rules.enableBombsPair,
        });

        if (botPlay && botPlay.length > 0) {
          const combo = checkCombination(botPlay);
          socketRef.current?.emit('play-cards', { roomCode: roomState.code, cards: botPlay, comboType: combo.type });
        } else {
          socketRef.current?.emit('pass-turn', { roomCode: roomState.code });
        }
      }, 1500); // 1.5s delay for realistic bot play
    }
  };

  const sendChatMessage = (text: string) => {
    if (!text.trim()) return;
    if (isSinglePlayer) {
      const newMsg: ChatMessage = {
        id: `msg_${Math.random().toString(36).substr(2, 9)}`,
        senderName: playerName || 'Player',
        senderId: 'local_user',
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: false,
      };
      setChatMessages(prev => [...prev, newMsg]);
    } else {
      socketRef.current?.emit('send-chat', { roomCode, message: text });
    }
  };

  const triggerBotChatMessage = (botName: string, botId: string, actionType: 'play' | 'pass' | 'win' | 'bomb') => {
    const roll = Math.random();
    let text = '';
    
    if (actionType === 'bomb') {
      const quotes = [
        "💥 BOOM! Direct hit!",
        "💥 Slammed! Try beating that!",
        "💥 Kaboom! Out of the way!",
        "💥 Bomb's away! Let's see who's next."
      ];
      text = quotes[Math.floor(Math.random() * quotes.length)];
    } else if (actionType === 'win') {
      const quotes = [
        "🎉 Woohoo! Big Two champion!",
        "🎉 GGEZ! Clean play!",
        "🎉 Yes! Shed them all!",
        "🎉 GG everyone, well played!"
      ];
      text = quotes[Math.floor(Math.random() * quotes.length)];
    } else if (actionType === 'pass' && roll < 0.3) {
      const quotes = [
        "Pass, too high for me.",
        "Pass! Keeping my best for later.",
        "No can do, passing this turn.",
        "Too rich for my blood. Pass!"
      ];
      text = quotes[Math.floor(Math.random() * quotes.length)];
    } else if (actionType === 'play' && roll < 0.25) {
      const quotes = [
        "Take that!",
        "Just a small card...",
        "Here we go!",
        "Can you beat this?",
        "Easy play."
      ];
      text = quotes[Math.floor(Math.random() * quotes.length)];
    }

    if (text) {
      setTimeout(() => {
        const newMsg: ChatMessage = {
          id: `msg_${Math.random().toString(36).substr(2, 9)}`,
          senderName: botName,
          senderId: botId,
          text: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: false,
        };
        setChatMessages(prev => [...prev, newMsg]);
        if (!isChatOpenRef.current) {
          setUnreadChatCount(prev => prev + 1);
        }
      }, 800 + Math.random() * 600);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  // ==================== Local Singleplayer Engine ====================
  const startSinglePlayerLobby = () => {
    setIsSinglePlayer(true);
    setRoomCode('LOCAL');
    setErrorMsg('');
    setChatMessages([]);
    setIsChatOpen(false);
    setUnreadChatCount(0);

    // Generate local players (1 user + 3 bots)
    const localUser: Player = {
      id: 'local_user',
      name: playerName || 'Player',
      avatar,
      isHost: true,
      isReady: true,
      isBot: false,
      cards: [],
      passed: false,
      score: 0,
      lastPlay: null,
    };

    const bots: Player[] = [
      {
        id: 'bot_1',
        name: 'Siti Bot',
        avatar: { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
        isHost: false,
        isReady: true,
        isBot: true,
        cards: [],
        passed: false,
        score: 0,
        lastPlay: null,
      },
      {
        id: 'bot_2',
        name: 'Budi Bot',
        avatar: { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
        isHost: false,
        isReady: true,
        isBot: true,
        cards: [],
        passed: false,
        score: 0,
        lastPlay: null,
      },
      {
        id: 'bot_3',
        name: 'Joko Bot',
        avatar: { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
        isHost: false,
        isReady: true,
        isBot: true,
        cards: [],
        passed: false,
        score: 0,
        lastPlay: null,
      },
    ];

    setPlayers([localUser, ...bots]);
    setGameState('lobby');
    setScreen('lobby');
  };

  const startSinglePlayerGame = () => {
    sfx.playDeal();
    
    // Auto-fill empty slots with bots up to 4 players
    let currentPlayers = [...players];
    const botNames = ['Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot'];
    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
    ] as AvatarConfig[];

    while (currentPlayers.length < 4) {
      const existingNames = currentPlayers.map((p) => p.name);
      const botName = botNames.find((n) => !existingNames.includes(n)) || `Bot ${currentPlayers.length + 1}`;
      const botAvatar = botAvatars[currentPlayers.length % botAvatars.length];
      
      currentPlayers.push({
        id: `bot_${Math.random()}`,
        name: botName,
        avatar: botAvatar,
        isHost: false,
        isReady: true,
        isBot: true,
        cards: [],
        passed: false,
        score: 0,
        lastPlay: null,
      });
    }

    const hands = dealCards(4);
    const updatedPlayers = currentPlayers.map((p, idx) => ({
      ...p,
      cards: hands[idx],
      passed: false,
      lastPlay: null,
      roundPoints: 0,
      finishRank: undefined,
    }));

    // Find starting player containing 3 of Diamonds
    let startIdx = 0;
    updatedPlayers.forEach((p, idx) => {
      if (contains3Diamonds(p.cards as Card[])) {
        startIdx = idx;
      }
    });

    setPlayers(updatedPlayers);
    setTurnIndex(startIdx);
    setActivePlay(null);
    setLastPlayerPlayedId(null);
    setGameState('playing');
    setScreen('table');

    // Chat system logs
    const initialMsgs = updatedPlayers.map(p => ({
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `${p.name} joined the table.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    }));
    setChatMessages(initialMsgs);
  };

  // Singleplayer Turn Controller
  useEffect(() => {
    if (!isSinglePlayer || gameState !== 'playing') return;

    const currentPlayer = players[turnIndex];
    if (currentPlayer && currentPlayer.isBot) {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);

      const targetBotId = currentPlayer.id;

      botTimerRef.current = setTimeout(() => {
        // Retrieve the absolute freshest state from the ref
        const { players: latestPlayers, turnIndex: latestTurnIndex, activePlay: latestActivePlay, gameState: latestGameState, rules: latestRules } = stateRef.current;

        // Validation guard: Verify game state is still playing
        if (latestGameState !== 'playing') return;

        // Validation guard: Verify it is still this bot's turn
        const activePlayer = latestPlayers[latestTurnIndex];
        if (!activePlayer || activePlayer.id !== targetBotId) {
          console.warn(`[Bot Timer Guard] Stale timer prevented bot ${targetBotId} from playing out of turn.`);
          return;
        }

        const hand = activePlayer.cards.filter((c): c is Card => c !== null);
        
        // Is it the very first play of the game?
        const isFirstPlay = latestPlayers.every(p => p.cards.length === 13) && !latestActivePlay;

        const play = getBotPlay(hand, latestActivePlay, isFirstPlay, {
          enableBombsSingle: latestRules.enableBombsSingle,
          enableBombsPair: latestRules.enableBombsPair,
        });

        if (play && play.length > 0) {
          playCardsSingle(activePlayer.id, play);
        } else {
          passTurnSingle(activePlayer.id);
        }
      }, 1500); // 1.5 seconds delay for natural thinking feel
    }

    // Cleanup function ensures any pending bot timer is canceled when turn/game changes
    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
      }
    };
  }, [turnIndex, gameState, isSinglePlayer]);

  function playCardsSingle(pId: string, cards: Card[]) {
    const { players: currentPlayers, turnIndex: currentTurnIndex } = stateRef.current;

    const idx = currentPlayers.findIndex((p) => p.id === pId);
    if (idx === -1 || idx !== currentTurnIndex) return;

    // Count how many players have already finished (have finishRank set)
    const finishedCount = currentPlayers.filter((p) => p.finishRank !== undefined).length;

    const updated = currentPlayers.map((player, index) => {
      if (index === idx) {
        const cardIds = cards.map((c) => c.id);
        const remainingCards = player.cards.filter((c) => c && !cardIds.includes(c.id));
        return {
          ...player,
          cards: remainingCards,
          lastPlay: cards,
          passed: false,
          finishRank: remainingCards.length === 0 ? finishedCount + 1 : player.finishRank,
        };
      }
      return player;
    });

    const p = updated[idx];

    const nextActivePlay = {
      type: cards.length === 1 ? 'single' : cards.length === 2 ? 'pair' : cards.length === 3 ? 'tris' : checkCombination(cards).type,
      cards: cards,
    } as Combination;

    setPlayers(updated);
    setActivePlay(nextActivePlay);
    setLastPlayerPlayedId(pId);

    // Chat logs
    const suitSymbols: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
    const desc = cards.map(c => `${c.rank}${suitSymbols[c.suit]}`).join(' ');
    const comboType = cards.length === 1 ? 'Single' : cards.length === 2 ? 'Pair' : cards.length === 3 ? 'Tris' : '5-Card Combination';
    const sysMsg: ChatMessage = {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `${p.name} played ${comboType}: ${desc}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    };
    setChatMessages((prevMsgs) => [...prevMsgs, sysMsg]);

    const comboTypeToCheck = cards.length === 1 ? 'single' : cards.length === 2 ? 'pair' : cards.length === 3 ? 'tris' : checkCombination(cards).type;
    const isBomb = comboTypeToCheck === 'bomber' || comboTypeToCheck === 'straightflush';
    if (p.isBot) {
      triggerBotChatMessage(p.name, p.id, isBomb ? 'bomb' : 'play');
    }

    // Check if won / round over
    const playersWithCards = updated.filter((player) => player.cards.length > 0);
    if (playersWithCards.length <= 1) {
      // The last player remaining gets the last rank
      const finalUpdated = updated.map((player) => {
        if (player.cards.length > 0 && player.finishRank === undefined) {
          return {
            ...player,
            finishRank: updated.length,
          };
        }
        return player;
      });
      setTimeout(() => handleRoundOverSingle(finalUpdated), 200);
    } else {
      // Check if trick is won: all other players with cards have passed
      const otherPlayersWithCards = updated.filter(player => player.id !== pId && player.cards.length > 0);
      const allOthersPassed = otherPlayersWithCards.every(player => player.passed);
      
      if (allOthersPassed) {
        if (p.cards.length === 0) {
          // Hibah / Gift: Clear active play and pass lead clockwise to next player with cards
          setActivePlay(null);
          setLastPlayerPlayedId(null);
          
          const resetPlayers = updated.map((player) => ({
            ...player,
            passed: false,
            lastPlay: null,
          }));
          setPlayers(resetPlayers);
          
          let nextIdx = idx;
          let found = false;
          for (let i = 0; i < resetPlayers.length; i++) {
            nextIdx = (nextIdx + 1) % resetPlayers.length;
            if (resetPlayers[nextIdx].cards.length > 0) {
              found = true;
              break;
            }
          }
          if (!found) {
            nextIdx = idx;
          }
          
          setTurnIndex(nextIdx);
          
          const leadPlayerName = resetPlayers[nextIdx].name;
          const trickSysMsg: ChatMessage = {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: `Trick finished. ${p.name} won the trick but has no cards left! Lead goes to ${leadPlayerName} (Hibah).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          };
          setChatMessages((prevMsgs) => [...prevMsgs, trickSysMsg]);
        } else {
          // Trick won by the current player (who still has cards)
          setActivePlay(null);
          setLastPlayerPlayedId(null);
          
          const resetPlayers = updated.map((player) => ({
            ...player,
            passed: false,
            lastPlay: null,
          }));
          setPlayers(resetPlayers);
          
          setTurnIndex(idx);
          
          const trickSysMsg: ChatMessage = {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: `Trick finished. ${p.name} gets the lead!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          };
          setChatMessages((prevMsgs) => [...prevMsgs, trickSysMsg]);
        }
      } else {
        const nextIdx = getNextTurnIndexLocal(currentTurnIndex, updated);
        setTurnIndex(nextIdx);
      }
    }
  }

  function passTurnSingle(pId: string) {
    const { players: currentPlayers, turnIndex: currentTurnIndex, lastPlayerPlayedId: currentLastPlayerPlayedId } = stateRef.current;

    const idx = currentPlayers.findIndex((p) => p.id === pId);
    if (idx === -1 || idx !== currentTurnIndex) return;

    const updated = currentPlayers.map((player, index) => {
      if (index === idx) {
        return {
          ...player,
          passed: true,
          lastPlay: null,
        };
      }
      return player;
    });

    const p = updated[idx];

    setPlayers(updated);

    // Chat logs
    const sysMsg: ChatMessage = {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `${p.name} passed.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    };
    setChatMessages((prevMsgs) => [...prevMsgs, sysMsg]);
    
    if (p.isBot) {
      triggerBotChatMessage(p.name, p.id, 'pass');
    }

    const activeCount = updated.filter((player) => !player.passed && player.cards.length > 0).length;
    if (activeCount <= 1) {
      // Trick won by the last played player!
      const lastPlayWinnerIdx = updated.findIndex((player) => player.id === currentLastPlayerPlayedId);
      const lastPlayWinnerName = lastPlayWinnerIdx !== -1 ? updated[lastPlayWinnerIdx].name : 'Unknown';

      setActivePlay(null);
      setLastPlayerPlayedId(null);
      
      const resetPlayers = updated.map((player) => ({
        ...player,
        passed: false,
        lastPlay: null,
      }));
      setPlayers(resetPlayers);

      // Set turn to trick winner. If trick winner has finished, find the next clockwise player who still has cards
      let nextIdx = lastPlayWinnerIdx;
      if (nextIdx === -1 || resetPlayers[nextIdx].cards.length === 0) {
        let searchIdx = lastPlayWinnerIdx !== -1 ? lastPlayWinnerIdx : currentTurnIndex;
        let found = false;
        for (let i = 0; i < resetPlayers.length; i++) {
          searchIdx = (searchIdx + 1) % resetPlayers.length;
          if (resetPlayers[searchIdx].cards.length > 0) {
            nextIdx = searchIdx;
            found = true;
            break;
          }
        }
        if (!found) {
          nextIdx = currentTurnIndex;
        }
      }
      setTurnIndex(nextIdx);

      const leadPlayerName = resetPlayers[nextIdx].name;
      // Chat logs
      const trickSysMsg: ChatMessage = {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: lastPlayWinnerIdx !== -1 && resetPlayers[lastPlayWinnerIdx].cards.length === 0
          ? `Trick finished. ${lastPlayWinnerName} won the trick but has no cards left! Lead goes to ${leadPlayerName}.`
          : `Trick finished. ${lastPlayWinnerName} gets the lead!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      };
      setChatMessages((prevMsgs) => [...prevMsgs, trickSysMsg]);
    } else {
      const nextIdx = getNextTurnIndexLocal(currentTurnIndex, updated);
      setTurnIndex(nextIdx);
    }
  }

  const getNextTurnIndexLocal = (current: number, currentPlayers: Player[]) => {
    let idx = current;
    const n = currentPlayers.length;
    for (let i = 0; i < n; i++) {
      idx = (idx + 1) % n;
      if (currentPlayers[idx] && !currentPlayers[idx].passed && currentPlayers[idx].cards.length > 0) {
        return idx;
      }
    }
    return current;
  };


  const handleRoundOverSingle = (finalPlayers: Player[]) => {
    setGameState('roundover');
    
    const numPlayers = finalPlayers.length;
    const scoredPlayers = finalPlayers.map(p => {
      const rank = p.finishRank || numPlayers;
      const points = numPlayers - rank + 1;
      
      const newScore = p.score + points;
      return {
        ...p,
        score: newScore,
        roundPoints: points,
      };
    });

    setPlayers(scoredPlayers);

    // Chat logs
    const winner = finalPlayers.find(p => p.finishRank === 1);
    const winnerName = winner ? winner.name : 'Unknown';
    const roundOverMsg: ChatMessage = {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `🎉 ${winnerName} won the round! 🎉`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    };
    setChatMessages(prevMsgs => [...prevMsgs, roundOverMsg]);
    
    if (winner && winner.isBot) {
      triggerBotChatMessage(winner.name, winner.id, 'win');
    }

    // Check tournament win
    const someoneWon = scoredPlayers.some((p) => p.score >= rules.pointsToWin);
    if (someoneWon) {
      setGameState('gameover');
    }
  };

  const restartSinglePlayerGameRound = () => {
    if (gameState === 'gameover') {
      // Reset scores completely
      const resetScores = players.map(p => ({ ...p, score: 0, roundPoints: 0 }));
      setPlayers(resetScores);
    }
    setGameState('lobby');
    // Start game directly
    setTimeout(() => {
      startSinglePlayerGame();
    }, 100);
  };

  const leaveRoom = () => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketId('');
    setIsSinglePlayer(false);
    setRoomCode('');
    setGameState('lobby');
    setScreen('menu');
  };

  // ==================== Render Screen Switching ====================
  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {screen === 'menu' && (
        <div className="menu-container">
          <div className="glass-panel menu-panel">
            <div className="menu-title-section">
              <h1 className="menu-title">Capsa Banting</h1>
              <p className="menu-subtitle">Indonesian Big Two Card Game</p>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid var(--accent-red)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', color: '#fda4af', textAlign: 'center' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Avatar Creator Panel */}
            <div className="name-input-group">
              <label>Your Profile Name</label>
              <input
                type="text"
                placeholder="Enter player name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                maxLength={12}
              />
            </div>

            <AvatarCreator config={avatar} onChange={setAvatar} />

            {/* Server Settings (Custom address deployment) */}
            <div style={{ alignSelf: 'flex-start' }}>
              <button
                type="button"
                className="btn-utility"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 0 }}
                onClick={() => setCustomServerVisible(!customServerVisible)}
              >
                ⚙️ {customServerVisible ? 'Hide Server Settings' : 'Custom Server Settings'}
              </button>
            </div>

            {customServerVisible && (
              <div className="name-input-group" style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '10px' }}>
                <label>Socket Server Host URL</label>
                <input
                  type="text"
                  placeholder="http://localhost:3001"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                />
              </div>
            )}

            <div className="menu-actions">
              <button className="btn-gold" onClick={startSinglePlayerLobby}>
                🤖 Play vs Bots
              </button>
              <button className="btn-primary" onClick={createOnlineRoom}>
                🌐 Create Room
              </button>
            </div>

            <div className="or-divider">Or join a friend's room</div>

            <div className="room-join-panel">
              <input
                type="text"
                placeholder="Enter 4-Letter Room Code"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.slice(0, 4))}
                maxLength={4}
              />
              <button className="btn-primary" onClick={joinOnlineRoom}>
                Join Game
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <div className="lobby-container">
          <div className="lobby-header">
            <div>
              <h2 style={{ fontSize: '2rem', background: 'linear-gradient(to right, #a78bfa, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Game Lobby
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                {isSinglePlayer ? 'Offline Practice Arena' : 'Invite friends to play!'}
              </p>
            </div>

            <div className="lobby-code-display">
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>ROOM CODE:</span>
              <div className="lobby-code-badge">{roomCode}</div>
            </div>
          </div>

          {/* Left panel: Seats & Players */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Players ({players.length}/4)
            </h3>

            <div className="lobby-players-grid">
              {players.map((p) => {
                const isLocal = p.id === 'local_user' || p.id === socketId;
                const isHostPlayer = p.isHost;

                return (
                  <div key={p.id} className={`lobby-player-card ${isHostPlayer ? 'host-border' : ''}`}>
                    <AvatarSVG config={p.avatar} size={48} />
                    <div className="lobby-player-details">
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                        {p.name} {isLocal ? '(You)' : ''}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {isHostPlayer && <span className="player-tag host">Host</span>}
                        {p.isBot && <span className="player-tag bot">Bot</span>}
                        {p.isReady ? <span className="player-tag ready">Ready</span> : <span className="player-tag waiting">Waiting</span>}
                      </div>
                    </div>

                    {/* Allow host to kick other players / bots */}
                    {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost && !isLocal && (
                      <button
                        className="kick-btn"
                        onClick={() => {
                          if (isSinglePlayer) {
                            setPlayers((prev) => prev.filter((pl) => pl.id !== p.id));
                          } else {
                            kickPlayerOnline(p.id);
                          }
                        }}
                        title="Remove Player"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Empty seats visualizer */}
              {Array.from({ length: 4 - players.length }).map((_, i) => (
                <div key={i} className="lobby-player-card" style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'none', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Empty Seat</span>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid var(--accent-red)', padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', color: '#fda4af', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
              <button className="btn-secondary" onClick={leaveRoom}>
                Leave Lobby
              </button>

              {/* Ready / Start Actions */}
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                <button
                  className="btn-gold"
                  style={{ flexGrow: 1 }}
                  disabled={!isSinglePlayer && !players.every(p => p.isReady)}
                  onClick={isSinglePlayer ? startSinglePlayerGame : startOnlineGame}
                >
                  🚀 Start Game
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ flexGrow: 1 }}
                  onClick={toggleReadyOnline}
                >
                  {players.find(p => p.id === socketId)?.isReady ? 'Cancel Ready' : 'Ready Up'}
                </button>
              )}
            </div>
          </div>

          {/* Right panel: Lobby Host Rules & Settings */}
          <div className="glass-panel settings-panel">
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Table Rules & Settings
            </h3>

            {/* Points to Win */}
            <div className="settings-row">
              <label>Target Points to Win</label>
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                <select
                  value={rules.pointsToWin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const updated = { ...rules, pointsToWin: val };
                    setRules(updated);
                    if (!isSinglePlayer) updateRulesOnline(updated);
                  }}
                >
                  <option value={10}>10 Points</option>
                  <option value={15}>15 Points</option>
                  <option value={20}>20 Points</option>
                  <option value={30}>30 Points</option>
                </select>
              ) : (
                <span style={{ fontWeight: 'bold' }}>{rules.pointsToWin} pts</span>
              )}
            </div>

            {/* Turn Timer Duration */}
            <div className="settings-row">
              <label>Turn Limit Duration</label>
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                <select
                  value={rules.turnDuration}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const updated = { ...rules, turnDuration: val };
                    setRules(updated);
                    if (!isSinglePlayer) updateRulesOnline(updated);
                  }}
                >
                  <option value={15}>15 Seconds</option>
                  <option value={30}>30 Seconds</option>
                  <option value={45}>45 Seconds</option>
                  <option value={0}>No Limit</option>
                </select>
              ) : (
                <span style={{ fontWeight: 'bold' }}>{rules.turnDuration === 0 ? 'No Limit' : `${rules.turnDuration}s`}</span>
              )}
            </div>

            {/* Bombing Single 2 Toggle */}
            <div className="settings-row">
              <label>Slam Single 2 with Bombs</label>
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={rules.enableBombsSingle}
                    onChange={(e) => {
                      const updated = { ...rules, enableBombsSingle: e.target.checked };
                      setRules(updated);
                      if (!isSinglePlayer) updateRulesOnline(updated);
                    }}
                  />
                  <span className="slider" />
                </label>
              ) : (
                <span style={{ fontWeight: 'bold' }}>{rules.enableBombsSingle ? 'Enabled' : 'Disabled'}</span>
              )}
            </div>

            {/* Bombing Pair of 2s Toggle */}
            <div className="settings-row">
              <label>Slam Pair 2s with Bombs</label>
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={rules.enableBombsPair}
                    onChange={(e) => {
                      const updated = { ...rules, enableBombsPair: e.target.checked };
                      setRules(updated);
                      if (!isSinglePlayer) updateRulesOnline(updated);
                    }}
                  />
                  <span className="slider" />
                </label>
              ) : (
                <span style={{ fontWeight: 'bold' }}>{rules.enableBombsPair ? 'Enabled' : 'Disabled'}</span>
              )}
            </div>

            {/* Seat fill with bot buttons (only for host) */}
            {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost && players.length < 4 && (
              <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column' }}>
                <button
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #1d72b8 0%, #1e40af 100%)', boxShadow: 'none' }}
                  onClick={() => {
                    if (isSinglePlayer) {
                      const botNames = ['Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot'];
                      const existing = players.map((p) => p.name);
                      const botName = botNames.find((n) => !existing.includes(n)) || `Bot ${players.length + 1}`;
                      
                      const botAvatars = [
                        { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
                        { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
                        { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
                      ] as AvatarConfig[];
                      const botAvatar = botAvatars[players.length % botAvatars.length];

                      setPlayers((prev) => [
                        ...prev,
                        {
                          id: `bot_${Math.random()}`,
                          name: botName,
                          avatar: botAvatar,
                          isHost: false,
                          isReady: true,
                          isBot: true,
                          cards: [],
                          passed: false,
                          score: 0,
                          lastPlay: null,
                        },
                      ]);
                    } else {
                      addBotOnline();
                    }
                  }}
                >
                  🤖 Add AI Bot Opponent
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'table' && (
        <GameTable
          playerId={isSinglePlayer ? 'local_user' : socketId}
          players={players}
          turnIndex={turnIndex}
          activePlay={activePlay}
          lastPlayerPlayedId={lastPlayerPlayedId}
          gameState={gameState}
          rules={rules}
          onPlayCards={isSinglePlayer ? (cards) => playCardsSingle('local_user', cards) : playCardsOnline}
          onPass={isSinglePlayer ? () => passTurnSingle('local_user') : passTurnOnline}
          onRestartGame={isSinglePlayer ? restartSinglePlayerGameRound : restartOnlineGame}
          onLeaveRoom={leaveRoom}
          isSinglePlayer={isSinglePlayer}
          roomCode={roomCode}
          isHost={players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost || false}
        />
      )}

      {screen !== 'menu' && (
        <>
          {/* Floating Chat Button */}
          <button 
            className={`floating-chat-btn ${isChatOpen ? 'hidden' : ''}`} 
            onClick={() => setIsChatOpen(true)}
            title="Open Chat"
          >
            💬
            {unreadChatCount > 0 && (
              <span className="chat-badge">{unreadChatCount}</span>
            )}
          </button>

          {/* Chat Sidebar Drawer */}
          <div className={`chat-drawer ${isChatOpen ? 'open' : ''}`}>
            <div className="chat-drawer-header">
              <h3>Room Chat</h3>
              <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>✕</button>
            </div>
            
            <div className="chat-messages-container" ref={chatMessagesContainerRef}>
              {chatMessages.map((msg) => {
                if (msg.system) {
                  return (
                    <div key={msg.id} className="chat-message-system">
                      {msg.text}
                    </div>
                  );
                }
                
                const isMe = msg.senderId === 'local_user' || msg.senderId === socketId;
                return (
                  <div key={msg.id} className={`chat-message-row ${isMe ? 'me' : 'other'}`}>
                    <div className="chat-message-bubble">
                      <span className="chat-sender">{msg.senderName}</span>
                      <p className="chat-text">{msg.text}</p>
                      <span className="chat-timestamp">{msg.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                maxLength={100}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Send</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
