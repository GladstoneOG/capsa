import { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AvatarCreator, getRandomAvatar, AvatarSVG } from './components/AvatarCreator';
import type { AvatarConfig } from './components/AvatarCreator';
import { GameTable } from './components/GameTable';
import { checkCombination, dealCards, getBotPlay, contains3Diamonds } from './utils/gameLogic';
import type { Card, Combination } from './utils/gameLogic';
import { sfx } from './utils/audio';
import { UnoTable } from './components/UnoTable';
import { getBotPlayDecision, type UnoCard } from './utils/unoLogic';
import './uno.css';
import { Confetti } from './components/Confetti';
import { MonopolyTable } from './components/MonopolyTable';
import { LOCAL_BOARD_TILES, LOCAL_CHANCE_CARDS, LOCAL_CHEST_CARDS, getBotMonopolyDecision, evaluateBotTrade } from './utils/monopolyLogic';
import type { TileState } from './utils/monopolyLogic';
import './monopoly.css';
import { FallingBackground } from './components/FallingBackground';

type Screen = 'menu' | 'lobby' | 'table';

interface Player {
  id: string;
  name: string;
  avatar: AvatarConfig;
  isHost: boolean;
  isBot: boolean;
  cards: any[];
  passed: boolean;
  score: number;
  lastPlay: any[] | null;
  roundPoints?: number;
  isReady: boolean;
  finishRank?: number;
  safeUno?: boolean;
  disconnected?: boolean;
  money?: number;
  position?: number;
  inJail?: boolean;
  jailTurns?: number;
  getOutOfJailCards?: number;
  bankrupt?: boolean;
  lastRoll?: number[];
  rollCount?: number;
  doublesRolled?: boolean;
  netWorth?: number;
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
  stacking?: boolean;
  jumpIn?: boolean;
  sevenSwap?: boolean;
  zeroRotate?: boolean;
  drawTillPlay?: boolean;
  ruleset?: string;
  startingCash?: number;
  turnLimit?: number;
}

const INDONESIAN_NAMES = ['Aris', 'Budi', 'Candra', 'Dewi', 'Eko', 'Fitri', 'Giri', 'Hadi', 'Indra', 'Joko', 'Kartika', 'Laras', 'Mega', 'Nugroho', 'Putri', 'Rian', 'Siti', 'Taufik', 'Utami', 'Wulan'];
const BOT_NAMES = [
  // Indonesian Names
  'Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot', 'Agus Bot',
  'Sari Bot', 'Rudi Bot', 'Ani Bot', 'Aris Bot', 'Dewo Bot',
  'Fitri Bot', 'Mega Bot', 'Candra Bot', 'Nugroho Bot', 'Putri Bot',
  'Taufik Bot', 'Wulan Bot', 'Hendra Bot', 'Bambang Bot', 'Slamet Bot',
  'Kartini Bot', 'Surya Bot', 'Guntur Bot', 'Indah Bot', 'Ratna Bot',
  'Wira Bot', 'Eko Bot', 'Yanto Bot', 'Rian Bot', 'Laras Bot',
  'Giri Bot', 'Hadi Bot', 'Indra Bot', 'Kartika Bot', 'Utami Bot',
  // Western Names
  'Alex Bot', 'Emma Bot', 'Liam Bot', 'Olivia Bot', 'Noah Bot',
  'Sophia Bot', 'Logan Bot', 'Ava Bot', 'Lucas Bot', 'Mia Bot',
  'Ethan Bot', 'Isabella Bot', 'Jackson Bot', 'Charlotte Bot', 'Oliver Bot',
  'Amelia Bot', 'James Bot', 'Harper Bot', 'Benjamin Bot', 'Evelyn Bot',
  'Leo Bot', 'Lily Bot', 'Max Bot', 'Zoe Bot', 'Sam Bot',
  'Grace Bot', 'Jack Bot', 'Ruby Bot', 'Toby Bot', 'Chloe Bot'
];
const PLAYER_SESSION_STORAGE_KEY = 'capsa_player_session_id';

function getOrCreatePlayerSessionId() {
  const existing = localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const nextId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `session_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, nextId);
  return nextId;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = localStorage.getItem('capsa_player_name');
    if (saved) return saved;
    return INDONESIAN_NAMES[Math.floor(Math.random() * INDONESIAN_NAMES.length)];
  });
  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    const saved = localStorage.getItem('capsa_player_avatar');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return getRandomAvatar();
  });

  // Persist name and avatar to localStorage when changed
  useEffect(() => {
    if (playerName.trim()) {
      localStorage.setItem('capsa_player_name', playerName);
    }
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem('capsa_player_avatar', JSON.stringify(avatar));
  }, [avatar]);
  const [serverUrl, setServerUrl] = useState<string>(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  const [customServerVisible, setCustomServerVisible] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [playerSessionId] = useState<string>(() => getOrCreatePlayerSessionId());

  // Mobile detection
  const [isMobileLandscape, setIsMobileLandscape] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Detect mobile landscape and portrait orientation, and disable right-click context menu
  useEffect(() => {
    const mobileLandscapeQuery = window.matchMedia('(max-width: 932px) and (max-height: 500px) and (orientation: landscape)');
    const mobilePortraitQuery = window.matchMedia('(max-width: 600px) and (orientation: portrait)');
    // Also detect landscape phones that are slightly bigger
    const mobileTouchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');

    const handleChange = () => {
      const isTouchDevice = mobileTouchQuery.matches;
      setIsMobileLandscape(mobileLandscapeQuery.matches || (isTouchDevice && window.innerWidth <= 932 && window.innerWidth > window.innerHeight));
      setIsPortrait(mobilePortraitQuery.matches || (isTouchDevice && window.innerHeight > window.innerWidth && window.innerWidth <= 600));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    handleChange();
    mobileLandscapeQuery.addEventListener('change', handleChange);
    mobilePortraitQuery.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    document.addEventListener('contextmenu', handleContextMenu);

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      mobileLandscapeQuery.removeEventListener('change', handleChange);
      mobilePortraitQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }, []);

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
    stacking: true,
    jumpIn: true,
    sevenSwap: true,
    zeroRotate: true,
    drawTillPlay: true,
    ruleset: 'Default',
    startingCash: 1500,
    turnLimit: 0,
  });
  const [gameType, setGameType] = useState<'capsa' | 'uno' | 'monopoly'>('capsa');
  const [unoCurrentColor, setUnoCurrentColor] = useState<string>('red');
  const [unoCurrentValue, setUnoCurrentValue] = useState<string>('0');
  const [unoPlayDirection, setUnoPlayDirection] = useState<number>(1);
  const [unoAccumulatedDrawCount, setUnoAccumulatedDrawCount] = useState<number>(0);
  const [unoSevenSwappingPlayerId, setUnoSevenSwappingPlayerId] = useState<string | null>(null);
  const [unoLastSevenSwap, setUnoLastSevenSwap] = useState<{ requesterId: string; targetId: string } | null>(null);
  const [lastUnoChallenge, setLastUnoChallenge] = useState<{ challengerId: string; targetPlayerId: string; timestamp: number } | null>(null);

  // Monopoly States
  const [monopolyBoard, setMonopolyBoard] = useState<TileState[]>([]);
  const [isMonopolyAnimating, setIsMonopolyAnimating] = useState<boolean>(false);
  const [monopolyPhase, setMonopolyPhase] = useState<'roll' | 'action' | 'jail_decision' | 'card_drawn' | 'bankrupt_decision' | 'end_turn' | 'auction' | 'festival_selection' | 'airport_selection' | 'force_acquire_decision' | 'use_angel_rent' | 'use_angel_force' | 'landed_build'>('roll');
  const [monopolyDice, setMonopolyDice] = useState<number[]>([1, 1]);
  const [monopolyRollId, setMonopolyRollId] = useState<string | null>(null);
  const [monopolyCurrentCard, setMonopolyCurrentCard] = useState<any | null>(null);
  const [monopolyCardType, setMonopolyCardType] = useState<string | null>(null);
  const [monopolyActiveDebt, setMonopolyActiveDebt] = useState<any | null>(null);
  const [monopolyAuctionState, setMonopolyAuctionState] = useState<any | null>(null);
  const [monopolyActiveTrade, setMonopolyActiveTrade] = useState<any | null>(null);
  const [monopolyChanceDeck, setMonopolyChanceDeck] = useState<any[]>([]);
  const [monopolyChestDeck, setMonopolyChestDeck] = useState<any[]>([]);
  const [monopolyLastActionDetail, setMonopolyLastActionDetail] = useState<any | null>(null);
  const [monopolyPendingForceAcquire, setMonopolyPendingForceAcquire] = useState<any | null>(null);
  const [monopolyPendingRent, setMonopolyPendingRent] = useState<any | null>(null);
  const [monopolyLandedBuildMaxHouses, setMonopolyLandedBuildMaxHouses] = useState<number>(4);
  const [monopolyTurnCount, setMonopolyTurnCount] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [unoDiscardPile, setUnoDiscardPile] = useState<UnoCard[]>([]);
  const [unoDrawPile, setUnoDrawPile] = useState<UnoCard[]>([]);
  const botDrawnRef = useRef<Record<string, boolean>>({});

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
  const hasConnectedRef = useRef<boolean>(false);
  const roomCodeRef = useRef<string>(roomCode);
  const screenRef = useRef<Screen>(screen);
  const isSinglePlayerRef = useRef<boolean>(isSinglePlayer);
  const playerNameRef = useRef<string>(playerName);
  const avatarRef = useRef<AvatarConfig>(avatar);
  const lastBotSyncRoomStateRef = useRef<any>(null);
  const triggerBotLogicForMultiplayerRef = useRef<any>(null);
  const prevSingleplayerBoardRef = useRef<any>(null);
  const prevSingleplayerPlayersRef = useRef<any>(null);
  const prevMultiplayerPlayersRef = useRef<any>(null);
  const visualPositionsRef = useRef<Record<string, number>>({});
  const stateRef = useRef({
    players,
    turnIndex,
    activePlay,
    lastPlayerPlayedId,
    gameState,
    rules,
    gameType,
    unoCurrentColor,
    unoCurrentValue,
    unoPlayDirection,
    unoAccumulatedDrawCount,
    unoSevenSwappingPlayerId,
    unoLastSevenSwap,
    unoDiscardPile,
    unoDrawPile,
    monopolyBoard,
    monopolyPhase,
    monopolyDice,
    monopolyCurrentCard,
    monopolyCardType,
    monopolyActiveDebt,
    monopolyAuctionState,
    monopolyActiveTrade,
    monopolyChanceDeck,
    monopolyChestDeck,
    monopolyLandedBuildMaxHouses
  });

  useEffect(() => {
    roomCodeRef.current = roomCode;
    screenRef.current = screen;
    isSinglePlayerRef.current = isSinglePlayer;
    playerNameRef.current = playerName;
    avatarRef.current = avatar;
  }, [roomCode, screen, isSinglePlayer, playerName, avatar]);

  // Update state ref for bot loop
  useEffect(() => {
    stateRef.current = {
      players,
      turnIndex,
      activePlay,
      lastPlayerPlayedId,
      gameState,
      rules,
      gameType,
      unoCurrentColor,
      unoCurrentValue,
      unoPlayDirection,
      unoAccumulatedDrawCount,
      unoSevenSwappingPlayerId,
      unoLastSevenSwap,
      unoDiscardPile,
      unoDrawPile,
      monopolyBoard,
      monopolyPhase,
      monopolyDice,
      monopolyCurrentCard,
      monopolyCardType,
      monopolyActiveDebt,
      monopolyAuctionState,
      monopolyActiveTrade,
      monopolyChanceDeck,
      monopolyChestDeck,
      monopolyLandedBuildMaxHouses
    };
  }, [
    players,
    turnIndex,
    activePlay,
    lastPlayerPlayedId,
    gameState,
    rules,
    gameType,
    unoCurrentColor,
    unoCurrentValue,
    unoPlayDirection,
    unoAccumulatedDrawCount,
    unoSevenSwappingPlayerId,
    unoLastSevenSwap,
    unoDiscardPile,
    unoDrawPile,
    monopolyBoard,
    monopolyPhase,
    monopolyDice,
    monopolyCurrentCard,
    monopolyCardType,
    monopolyActiveDebt,
    monopolyAuctionState,
    monopolyActiveTrade,
    monopolyChanceDeck,
    monopolyChestDeck,
    monopolyLandedBuildMaxHouses
  ]);

  // Check query params if we were invited via a URL (e.g. /?room=ABCD)
  useEffect(() => {
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

  // Trigger win sounds and confetti on round/game end
  useEffect(() => {
    if (gameState === 'roundover' || gameState === 'gameover') {
      sfx.playWin();
      setShowConfetti(true);
    } else {
      setShowConfetti(false);
    }
  }, [gameState]);

  // Reset scroll positions when screen changes
  useEffect(() => {
    window.scrollTo(0, 0);
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.scrollTop = 0;
    }
  }, [screen]);

  // ==================== Socket.io Handlers ====================
  const applyRoomStateFromServer = (room: any, nextScreen?: Screen) => {
    setRoomCode(room.code || roomCodeRef.current);
    setPlayers(room.players);
    setTurnIndex(room.turnIndex || 0);
    setActivePlay(room.activePlay || null);
    setLastPlayerPlayedId(room.lastPlayerPlayedId || null);
    setRules(room.rules);
    setGameState(room.gameState);
    setGameType(room.gameType || 'capsa');
    if (room.gameType === 'uno') {
      setUnoCurrentColor(room.currentColor || 'red');
      setUnoCurrentValue(room.currentValue || '0');
      setUnoPlayDirection(room.playDirection || 1);
      setUnoAccumulatedDrawCount(room.accumulatedDrawCount || 0);
      setUnoSevenSwappingPlayerId(room.sevenSwappingPlayerId || null);
      setUnoLastSevenSwap(room.lastSevenSwap || null);
      setUnoDiscardPile(room.discardPile || []);
    }
    if (room.gameType === 'monopoly') {
      setMonopolyBoard(room.monopolyBoard || []);
      setMonopolyPhase(room.monopolyPhase || 'roll');
      setMonopolyDice(room.dice || [1, 1]);
      setMonopolyRollId(room.rollId || null);
      setMonopolyCurrentCard(room.currentCard || null);
      setMonopolyCardType(room.cardType || null);
      setMonopolyActiveDebt(room.activeDebt || null);
      setMonopolyAuctionState(room.auctionState || null);
      setMonopolyActiveTrade(room.activeTrade || null);
      setMonopolyPendingForceAcquire(room.pendingForceAcquire || null);
      setMonopolyPendingRent(room.pendingRent || null);
      setMonopolyLastActionDetail(room.lastActionDetail || null);
      setMonopolyLandedBuildMaxHouses(room.landedBuildMaxHouses !== undefined ? room.landedBuildMaxHouses : 4);
      setMonopolyTurnCount(room.monopolyTurnCount || 0);
    }
    if (nextScreen) {
      setScreen(nextScreen);
    }
  };

  const initSocket = () => {
    if (socketRef.current) socketRef.current.disconnect();
    hasConnectedRef.current = false;

    // Check if we are in local dev, otherwise fallback to local port
    const finalUrl = serverUrl || 'http://localhost:3001';
    const socket = io(finalUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketId(socket.id || '');
      const wasReconnect = hasConnectedRef.current;
      hasConnectedRef.current = true;

      if (wasReconnect && !isSinglePlayerRef.current && roomCodeRef.current && screenRef.current !== 'menu') {
        socket.emit('resume-room', {
          roomCode: roomCodeRef.current,
          playerName: playerNameRef.current,
          avatar: avatarRef.current,
          sessionId: playerSessionId,
        });
      }
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
      setGameType(room.gameType || 'capsa');
      if (room.gameType === 'uno') {
        setUnoCurrentColor(room.currentColor || 'red');
        setUnoCurrentValue(room.currentValue || '0');
        setUnoPlayDirection(room.playDirection || 1);
        setUnoAccumulatedDrawCount(room.accumulatedDrawCount || 0);
        setUnoSevenSwappingPlayerId(room.sevenSwappingPlayerId || null);
        setUnoLastSevenSwap(room.lastSevenSwap || null);
        setUnoDiscardPile(room.discardPile || []);
      }
      if (room.gameType === 'monopoly') {
        setMonopolyBoard(room.monopolyBoard || []);
        setMonopolyPhase(room.monopolyPhase || 'roll');
        setMonopolyDice(room.dice || [1, 1]);
        setMonopolyCurrentCard(room.currentCard || null);
        setMonopolyCardType(room.cardType || null);
        setMonopolyActiveDebt(room.activeDebt || null);
        setMonopolyTurnCount(room.monopolyTurnCount || 0);
      }
      setScreen('lobby');
      setErrorMsg('');
    });

    socket.on('room-joined', ({ room }) => {
      applyRoomStateFromServer(room, 'lobby');
      setErrorMsg('');
    });

    socket.on('room-updated', (room) => {
      setPlayers(room.players);
      setRules(room.rules);
      setGameState(room.gameState);
      setGameType(room.gameType || 'capsa');
      if (room.gameType === 'monopoly') {
        setMonopolyBoard(room.monopolyBoard || []);
        setMonopolyPhase(room.monopolyPhase || 'roll');
        setMonopolyDice(room.dice || [1, 1]);
        setMonopolyCurrentCard(room.currentCard || null);
        setMonopolyCardType(room.cardType || null);
        setMonopolyActiveDebt(room.activeDebt || null);
        setMonopolyTurnCount(room.monopolyTurnCount || 0);
      }
      if (screenRef.current === 'menu') {
        setRoomCode(room.code || roomCodeRef.current);
        setScreen('lobby');
        setErrorMsg('');
      }
    });

    socket.on('room-resumed', (room) => {
      applyRoomStateFromServer(room, room.gameState === 'lobby' ? 'lobby' : 'table');
      setErrorMsg('');
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
      setGameType(room.gameType || 'capsa');
      if (room.gameType === 'uno') {
        setUnoCurrentColor(room.currentColor);
        setUnoCurrentValue(room.currentValue);
        setUnoPlayDirection(room.playDirection);
        setUnoAccumulatedDrawCount(room.accumulatedDrawCount);
        setUnoSevenSwappingPlayerId(room.sevenSwappingPlayerId);
        setUnoLastSevenSwap(room.lastSevenSwap || null);
        setUnoDiscardPile(room.discardPile || []);
      }
      if (room.gameType === 'monopoly') {
        setMonopolyBoard(room.monopolyBoard || []);
        setMonopolyPhase(room.monopolyPhase || 'roll');
        setMonopolyDice(room.dice || [1, 1]);
        setMonopolyRollId(room.rollId || null);
        setMonopolyCurrentCard(room.currentCard || null);
        setMonopolyCardType(room.cardType || null);
        setMonopolyActiveDebt(room.activeDebt || null);
        setMonopolyAuctionState(room.auctionState || null);
        setMonopolyActiveTrade(room.activeTrade || null);
        setMonopolyPendingForceAcquire(room.pendingForceAcquire || null);
        setMonopolyPendingRent(room.pendingRent || null);
        setMonopolyLastActionDetail(room.lastActionDetail || null);
        setMonopolyLandedBuildMaxHouses(room.landedBuildMaxHouses !== undefined ? room.landedBuildMaxHouses : 4);
        setMonopolyTurnCount(room.monopolyTurnCount || 0);
      }
      setScreen('table');
    });

    socket.on('game-updated', (room) => {
      setPlayers(room.players);
      setTurnIndex(room.turnIndex);
      setActivePlay(room.activePlay);
      setLastPlayerPlayedId(room.lastPlayerPlayedId);
      setGameState(room.gameState);
      setGameType(room.gameType || 'capsa');
      if (room.gameType === 'uno') {
        setUnoCurrentColor(room.currentColor);
        setUnoCurrentValue(room.currentValue);
        setUnoPlayDirection(room.playDirection);
        setUnoAccumulatedDrawCount(room.accumulatedDrawCount);
        setUnoSevenSwappingPlayerId(room.sevenSwappingPlayerId);
        setUnoLastSevenSwap(room.lastSevenSwap || null);
        setUnoDiscardPile(room.discardPile || []);
      }
      if (room.gameType === 'monopoly') {
        setMonopolyBoard(room.monopolyBoard || []);
        setMonopolyPhase(room.monopolyPhase || 'roll');
        setMonopolyDice(room.dice || [1, 1]);
        setMonopolyRollId(room.rollId || null);
        setMonopolyCurrentCard(room.currentCard || null);
        setMonopolyCardType(room.cardType || null);
        setMonopolyActiveDebt(room.activeDebt || null);
        setMonopolyAuctionState(room.auctionState || null);
        setMonopolyActiveTrade(room.activeTrade || null);
        setMonopolyPendingForceAcquire(room.pendingForceAcquire || null);
        setMonopolyPendingRent(room.pendingRent || null);
        setMonopolyLastActionDetail(room.lastActionDetail || null);
        setMonopolyLandedBuildMaxHouses(room.landedBuildMaxHouses !== undefined ? room.landedBuildMaxHouses : 4);
        setMonopolyTurnCount(room.monopolyTurnCount || 0);
      }
    });

    socket.on('round-over', (room) => {
      setPlayers(room.players);
      setGameState(room.gameState);
      setGameType(room.gameType || 'capsa');
      if (room.gameType === 'uno') {
        setUnoCurrentColor(room.currentColor);
        setUnoCurrentValue(room.currentValue);
        setUnoPlayDirection(room.playDirection);
        setUnoAccumulatedDrawCount(room.accumulatedDrawCount);
        setUnoSevenSwappingPlayerId(room.sevenSwappingPlayerId);
        setUnoLastSevenSwap(room.lastSevenSwap || null);
        setUnoDiscardPile(room.discardPile || []);
      }
      if (room.gameType === 'monopoly') {
        setMonopolyBoard(room.monopolyBoard || []);
        setMonopolyPhase(room.monopolyPhase || 'roll');
        setMonopolyDice(room.dice || [1, 1]);
        setMonopolyRollId(room.rollId || null);
        setMonopolyCurrentCard(room.currentCard || null);
        setMonopolyCardType(room.cardType || null);
        setMonopolyActiveDebt(room.activeDebt || null);
        setMonopolyAuctionState(room.auctionState || null);
        setMonopolyActiveTrade(room.activeTrade || null);
        setMonopolyPendingForceAcquire(room.pendingForceAcquire || null);
        setMonopolyPendingRent(room.pendingRent || null);
        setMonopolyLastActionDetail(room.lastActionDetail || null);
        setMonopolyLandedBuildMaxHouses(room.landedBuildMaxHouses !== undefined ? room.landedBuildMaxHouses : 4);
        setMonopolyTurnCount(room.monopolyTurnCount || 0);
      }
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

    socket.on('uno-challenge-success', ({ challengerId, targetPlayerId }) => {
      setLastUnoChallenge({
        challengerId,
        targetPlayerId,
        timestamp: Date.now()
      });
    });

    // Host bot coordinator listener
    socket.on('bot-coordinator-sync', (room) => {
      triggerBotLogicForMultiplayerRef.current?.(room);
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
    socketRef.current?.emit('create-room', {
      playerName,
      avatar,
      gameType,
      sessionId: playerSessionId,
    });
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
      sessionId: playerSessionId,
    });
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
    console.log('[BOT COORD] triggerBotLogicForMultiplayer called for phase:', roomState.monopolyPhase);
    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    const isMovingOrWillMoveOrBuilding = roomState.gameType === 'monopoly' && (
      isMonopolyAnimating ||
      roomState.monopolyPhase === 'rolling_animation' ||
      (roomState.players || []).some((p: any) => {
        const localP = (stateRef.current.players || []).find((lp: any) => lp.id === p.id);
        const stateDiff = localP && localP.position !== p.position;
        const visPos = visualPositionsRef.current[p.id];
        const visDiff = visPos !== undefined && visPos !== p.position;
        const diff = stateDiff || visDiff;
        if (diff) console.log(`[BOT COORD] Position discrepancy for ${p.name}: local=${localP?.position}, visual=${visPos}, server=${p.position}`);
        return diff;
      }) ||
      (roomState.monopolyBoard && (stateRef.current.monopolyBoard || []).length > 0 &&
        roomState.monopolyBoard.some((tile: any, idx: number) => {
          const localTile = (stateRef.current.monopolyBoard || [])[idx];
          const diff = localTile && tile.houses > localTile.houses;
          if (diff) console.log(`[BOT COORD] House discrepancy on tile ${idx}: local=${localTile?.houses}, server=${tile.houses}`);
          return diff;
        })
      )
    );

    console.log('[BOT COORD] isMovingOrWillMoveOrBuilding:', isMovingOrWillMoveOrBuilding, 'isMonopolyAnimating:', isMonopolyAnimating);

    if (isMovingOrWillMoveOrBuilding) {
      lastBotSyncRoomStateRef.current = roomState;
      return;
    }

    if (roomState.gameType === 'monopoly') {
      lastBotSyncRoomStateRef.current = null;
    }

    const { players: rPlayers, turnIndex: rTurnIdx, gameState: rGameSt } = roomState;
    if (rGameSt !== 'playing') {
      console.log('[BOT COORD] Exiting: game state is not playing:', rGameSt);
      return;
    }

    // Only host client coordinates bot logic for multiplayer
    const localPlayer = (stateRef.current.players || []).find((p: any) => p.id === socketId || p.id === socketRef.current?.id);
    const isHost = localPlayer?.isHost;
    console.log('[BOT COORD] localPlayer:', localPlayer?.name, 'isHost:', isHost, 'socketId:', socketId, 'socketRef ID:', socketRef.current?.id);
    if (!isHost) return;

    // Determine who needs to make a decision right now
    let targetBotId = null;
    let targetBotPlayer = null;

    if (roomState.gameType === 'monopoly') {
      if (roomState.monopolyPhase === 'auction' && roomState.auctionState) {
        const bidderId = roomState.auctionState.bidders[roomState.auctionState.activeBidderIndex];
        const bidder = rPlayers.find((p: any) => p.id === bidderId);
        if (bidder && bidder.isBot) {
          targetBotId = bidderId;
          targetBotPlayer = bidder;
        }
      } else if (roomState.monopolyPhase === 'use_angel_force' && roomState.pendingForceAcquire) {
        const faTile = roomState.monopolyBoard[roomState.pendingForceAcquire.tileIndex];
        if (faTile) {
          const owner = rPlayers.find((p: any) => p.id === faTile.owner);
          if (owner && owner.isBot) {
            targetBotId = owner.id;
            targetBotPlayer = owner;
          }
        }
      } else if (roomState.activeTrade && roomState.activeTrade.status === 'pending') {
        const receiver = rPlayers.find((p: any) => p.id === roomState.activeTrade.receiverId);
        if (receiver && receiver.isBot) {
          targetBotId = receiver.id;
          targetBotPlayer = receiver;
        }
      } else {
        const currentPlayer = rPlayers[rTurnIdx];
        if (currentPlayer && currentPlayer.isBot) {
          targetBotId = currentPlayer.id;
          targetBotPlayer = currentPlayer;
        }
      }
    } else {
      const currentPlayer = rPlayers[rTurnIdx];
      if (currentPlayer && currentPlayer.isBot) {
        targetBotId = currentPlayer.id;
        targetBotPlayer = currentPlayer;
      }
    }

    if (!targetBotId || !targetBotPlayer) {
      // Special swap target selection phase (not advanced to turnIndex yet)
      if (roomState.gameType === 'uno' && roomState.sevenSwappingPlayerId) {
        const activeSwappingPlayer = rPlayers.find((p: any) => p.id === roomState.sevenSwappingPlayerId);
        if (activeSwappingPlayer && activeSwappingPlayer.isBot) {
          botTimerRef.current = setTimeout(() => {
            const opponents = rPlayers.filter((p: any) => p.id !== activeSwappingPlayer.id);
            opponents.sort((a: any, b: any) => a.cards.length - b.cards.length);
            const target = opponents[0];
            if (target) {
              socketRef.current?.emit('swap-hand', { roomCode: roomState.code, targetPlayerId: target.id });
            }
          }, 1500);
        }
      }
      return;
    }

    const delay = (roomState.gameType === 'monopoly')
      ? (roomState.monopolyPhase === 'card_drawn' ? 3000 : 1000)
      : 1500;
    botTimerRef.current = setTimeout(() => {
      if (roomState.gameType === 'uno') {
        const hand = targetBotPlayer.cards.filter((c: any) => c !== null);
        const decision = getBotPlayDecision(
          hand,
          roomState.currentColor,
          roomState.currentValue,
          roomState.accumulatedDrawCount || 0,
          roomState.rules.stacking || false
        );

        if (decision.action === 'play') {
          socketRef.current?.emit('play-card', {
            roomCode: roomState.code,
            cards: [decision.card],
            chosenColor: decision.chosenColor,
            isJumpIn: false
          });

          // Bot Uno Call chance
          if (targetBotPlayer.cards.length <= 2 && !targetBotPlayer.safeUno) {
            if (Math.random() < 0.8) {
              socketRef.current?.emit('uno-call', { roomCode: roomState.code });
            }
          }
        } else {
          // Check if already drawn
          if (!botDrawnRef.current[targetBotPlayer.id]) {
            botDrawnRef.current[targetBotPlayer.id] = true;
            socketRef.current?.emit('draw-card', { roomCode: roomState.code });
          } else {
            botDrawnRef.current[targetBotPlayer.id] = false;
            socketRef.current?.emit('pass-turn', { roomCode: roomState.code });
          }
        }
      } else if (roomState.gameType === 'monopoly') {
        if (roomState.monopolyPhase === 'auction' && roomState.auctionState) {
          const bidderId = roomState.auctionState.bidders[roomState.auctionState.activeBidderIndex];
          if (bidderId !== targetBotId) return;

          const activeTileIndex = roomState.auctionState.tileIndex;
          const landedTile = roomState.monopolyBoard[activeTileIndex];
          const decision = getBotMonopolyDecision(
            targetBotPlayer,
            roomState.monopolyBoard,
            'auction',
            null,
            landedTile,
            roomState.auctionState
          );
          if (decision) {
            socketRef.current?.emit('monopoly-action', {
              roomCode: roomState.code,
              action: decision.action,
              payload: decision.payload
            });
          }
        } else if (roomState.activeTrade && roomState.activeTrade.status === 'pending' && roomState.activeTrade.receiverId === targetBotId) {
          const otherPlayer = rPlayers.find((pl: any) => pl.id === roomState.activeTrade.senderId);
          const accepted = evaluateBotTrade(targetBotPlayer, otherPlayer, roomState.monopolyBoard, roomState.activeTrade);
          socketRef.current?.emit('monopoly-action', {
            roomCode: roomState.code,
            action: accepted ? 'trade-accept' : 'trade-decline'
          });
        } else {
          const activeTileIndex = targetBotPlayer.position || 0;
          const landedTile = roomState.monopolyBoard[activeTileIndex];
          const decision = getBotMonopolyDecision(
            targetBotPlayer,
            roomState.monopolyBoard,
            roomState.monopolyPhase,
            roomState.monopolyActiveDebt,
            landedTile,
            null, // auctionState
            roomState.landedBuildMaxHouses !== undefined ? roomState.landedBuildMaxHouses : 4,
            roomState.rules?.ruleset === 'Get Rich'
          );
          console.log('[BOT COORD] Bot monopoly decision:', decision?.action, 'payload:', decision?.payload);
          if (decision) {
            console.log('[BOT COORD] Emitting bot decision to room:', roomState.code);
            socketRef.current?.emit('monopoly-action', {
              roomCode: roomState.code,
              action: decision.action,
              payload: decision.payload
            });
          }
        }
      } else {
        // Capsa logic
        const hand = targetBotPlayer.cards.filter((c: any) => c !== null);
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
      }
    }, delay);

    // Bot catching vulnerable players down to 1 card
    if (roomState.gameType === 'uno') {
      const host = rPlayers.find((p: any) => p.isHost);
      const isHost = host?.id === socketRef.current?.id;
      if (isHost) {
        const vulnerable = rPlayers.find((p: any) => p.cards.length === 1 && !p.safeUno);
        if (vulnerable) {
          // Find if there is a bot that will challenge them
          const bots = rPlayers.filter((p: any) => p.isBot && p.id !== vulnerable.id);
          if (bots.length > 0 && Math.random() < 0.70) {
            // 70% chance a bot spots them and challenges
            socketRef.current?.emit('uno-challenge', { roomCode: roomState.code, targetPlayerId: vulnerable.id });
          }
        }
      }
    }
  };

  // Keep triggerBotLogicForMultiplayerRef pointing to the freshest closure instance
  useEffect(() => {
    triggerBotLogicForMultiplayerRef.current = triggerBotLogicForMultiplayer;
  });

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
  // ==================== Local Singleplayer Engine ====================
  const startSinglePlayerLobby = () => {
    setIsSinglePlayer(true);
    setRoomCode('LOCAL');
    setErrorMsg('');
    setChatMessages([]);
    setIsChatOpen(false);
    setUnreadChatCount(0);

    // Set initial target points for local lobby
    if (gameType === 'uno') {
      setRules(prev => ({
        ...prev,
        pointsToWin: 250,
      }));
    } else {
      setRules(prev => ({
        ...prev,
        pointsToWin: 15,
      }));
    }

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

    const availableNames = BOT_NAMES.filter(n => n !== (playerName || 'Player'));
    const selectedNames: string[] = [];
    while (selectedNames.length < 3 && availableNames.length > 0) {
      const idx = Math.floor(Math.random() * availableNames.length);
      selectedNames.push(availableNames.splice(idx, 1)[0]);
    }
    while (selectedNames.length < 3) {
      selectedNames.push(`Bot ${selectedNames.length + 1}`);
    }

    const bots: Player[] = [
      {
        id: 'bot_1',
        name: selectedNames[0],
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
        name: selectedNames[1],
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
        name: selectedNames[2],
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

  // ==================== Local Uno Engine ====================
  const createLocalUnoDeck = (): UnoCard[] => {
    const colors: Array<'red' | 'yellow' | 'green' | 'blue'> = ['red', 'yellow', 'green', 'blue'];
    const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    const deck: UnoCard[] = [];

    for (const color of colors) {
      // One '0' card per color
      deck.push({ id: `uno_${color}_0`, color, value: '0' });

      // Two of '1'-'9', skip, reverse, draw2
      for (let i = 1; i < values.length; i++) {
        const val = values[i];
        deck.push({ id: `uno_${color}_${val}_a`, color, value: val });
        deck.push({ id: `uno_${color}_${val}_b`, color, value: val });
      }
    }

    // 4 Wilds and 4 Wild Draw Fours (+4)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `uno_wild_${i}`, color: 'wild', value: 'wild' });
      deck.push({ id: `uno_wild4_${i}`, color: 'wild', value: 'wild4' });
    }

    return deck;
  };

  const shuffleLocalUnoDeck = (deck: UnoCard[]): UnoCard[] => {
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const startSinglePlayerUnoGame = () => {
    sfx.playDeal();

    const currentPlayers = [...players];
    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
    ] as AvatarConfig[];

    // Ensure at least 2 players
    if (currentPlayers.length < 2) {
      const existingNames = currentPlayers.map((p) => p.name);
      const unusedNames = BOT_NAMES.filter((n) => !existingNames.includes(n));
      const botName = unusedNames.length > 0
        ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
        : `Bot ${currentPlayers.length + 1}`;
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

    let deck = shuffleLocalUnoDeck(createLocalUnoDeck());

    // Deal 7 cards to each player
    const updatedPlayers = currentPlayers.map((p) => ({
      ...p,
      cards: deck.splice(0, 7),
      passed: false,
      lastPlay: null,
      safeUno: false,
      roundPoints: 0,
      finishRank: undefined,
    }));

    let startingCard = deck.pop()!;
    while (startingCard.value === 'wild4') {
      deck.push(startingCard);
      deck = shuffleLocalUnoDeck(deck);
      startingCard = deck.pop()!;
    }

    const initialDiscardPile = [startingCard];
    let initialColor = startingCard.color;
    if (startingCard.color === 'wild') {
      initialColor = ['red', 'yellow', 'green', 'blue'][Math.floor(Math.random() * 4)] as any;
    }

    setUnoDiscardPile(initialDiscardPile);
    setUnoDrawPile(deck);
    setUnoCurrentColor(initialColor);
    setUnoCurrentValue(startingCard.value);
    setUnoPlayDirection(1);
    setUnoAccumulatedDrawCount(0);
    setUnoSevenSwappingPlayerId(null);
    setUnoLastSevenSwap(null);
    setLastUnoChallenge(null);
    setLastPlayerPlayedId(null);
    setPlayers(updatedPlayers);
    setGameState('playing');
    setScreen('table');

    // Starting messages
    const cardNames: Record<string, string> = {
      skip: 'Skip',
      reverse: 'Reverse',
      draw2: 'Draw Two (+2)',
      wild: 'Wild',
      wild4: 'Wild Draw Four (+4)'
    };
    const startCardDesc = startingCard.color === 'wild'
      ? `Wild (Chosen Color: ${initialColor.toUpperCase()})`
      : `${startingCard.color.toUpperCase()} ${cardNames[startingCard.value] || startingCard.value}`;

    const systemMsgs = [
      {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: `Game started! Starting card is ${startCardDesc}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      }
    ];
    setChatMessages(systemMsgs);

    // Apply starting card actions
    let initialTurn = 0;
    let initialPlayDir = 1;

    if (startingCard.value === 'reverse') {
      initialPlayDir = -1;
      setUnoPlayDirection(-1);
      if (updatedPlayers.length === 2) {
        initialTurn = (initialTurn + initialPlayDir + updatedPlayers.length) % updatedPlayers.length;
      }
    } else if (startingCard.value === 'skip') {
      initialTurn = (initialTurn + initialPlayDir + updatedPlayers.length) % updatedPlayers.length;
    } else if (startingCard.value === 'draw2') {
      if (rules.stacking) {
        setUnoAccumulatedDrawCount(2);
      } else {
        const firstPlayer = updatedPlayers[0];
        firstPlayer.cards.push(...deck.splice(0, 2));
        systemMsgs.push({
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `${firstPlayer.name} drew 2 cards from starting Draw Two and turn is skipped.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
        initialTurn = (initialTurn + initialPlayDir + updatedPlayers.length) % updatedPlayers.length;
      }
    }

    setTurnIndex(initialTurn);
  };

  const refillDrawPile = (discardPile: UnoCard[]): UnoCard[] => {
    const copy = [...discardPile];
    const topCard = copy.pop()!;
    const shuffled = shuffleLocalUnoDeck(copy);
    setUnoDiscardPile([topCard]);
    return shuffled;
  };

  const playCardUnoSingle = (card: UnoCard, chosenColor?: string, isJumpIn?: boolean) => {
    const {
      players: currentPlayers,
      turnIndex: currentTurnIdx,
      unoPlayDirection: currentPlayDir,
      unoCurrentColor: currentColor,
      unoCurrentValue: currentValue,
      unoAccumulatedDrawCount: currentAccumulated,
      unoDiscardPile: currentDiscardPile,
      unoDrawPile: currentDrawPile,
    } = stateRef.current;

    const player = currentPlayers.find((p) => p.cards.some((c) => c && c.id === card.id));
    if (!player) return;

    const playerIdx = currentPlayers.indexOf(player);
    const isMyTurn = currentTurnIdx === playerIdx;

    if (!isMyTurn) {
      if (isJumpIn && rules.jumpIn) {
        // Jump In verification
        if (card.color === currentColor && card.value === currentValue && card.color !== 'wild') {
          ioToSystemChat(`⚡ Jump-in! ${player.name} cut in out of turn!`);
        } else {
          return;
        }
      } else {
        return;
      }
    }

    const updatedPlayers = currentPlayers.map((p, idx) => {
      if (idx === playerIdx) {
        return {
          ...p,
          cards: p.cards.filter((c) => c && c.id !== card.id),
          lastPlay: [card],
        };
      }
      return p;
    });

    const activePlayer = updatedPlayers[playerIdx];
    const nextDiscardPile = [...currentDiscardPile, card];
    setUnoDiscardPile(nextDiscardPile);
    setLastPlayerPlayedId(player.id);

    const nextColor = card.color === 'wild' ? (chosenColor || 'red') : card.color;
    const nextValue = card.value;
    setUnoCurrentColor(nextColor);
    setUnoCurrentValue(nextValue);

    const cardNames: Record<string, string> = {
      skip: 'Skip',
      reverse: 'Reverse',
      draw2: 'Draw Two (+2)',
      wild: 'Wild',
      wild4: 'Wild Draw Four (+4)'
    };
    const cardDesc = card.color === 'wild'
      ? `${cardNames[card.value]} (Chosen Color: ${nextColor.toUpperCase()})`
      : `${card.color.toUpperCase()} ${cardNames[card.value] || card.value}`;

    ioToSystemChat(`${activePlayer.name} played ${cardDesc}.`);

    if (activePlayer.cards.length === 0) {
      setPlayers(updatedPlayers);
      setTimeout(() => handleRoundOverUnoSingle(updatedPlayers), 200);
      return;
    }

    if (card.value === '7' && rules.sevenSwap) {
      setPlayers(updatedPlayers);
      setUnoSevenSwappingPlayerId(activePlayer.id);
      return;
    }

    let nextPlayDir = currentPlayDir;
    let nextAccumulated = currentAccumulated;
    let turnsToAdvance = 1;

    if (card.value === '0' && rules.zeroRotate) {
      const numPlayers = updatedPlayers.length;
      const originalHands = updatedPlayers.map((p) => [...p.cards]);
      const rotatedPlayers = updatedPlayers.map((p, idx) => {
        const sourceIdx = (idx - currentPlayDir + numPlayers) % numPlayers;
        return {
          ...p,
          cards: originalHands[sourceIdx],
          safeUno: false,
        };
      });
      updatedPlayers.splice(0, updatedPlayers.length, ...rotatedPlayers);
      ioToSystemChat(`🔄 Hands rotated ${currentPlayDir === 1 ? 'clockwise' : 'counter-clockwise'}!`);
    }

    if (card.value === 'reverse') {
      nextPlayDir = currentPlayDir * -1;
      setUnoPlayDirection(nextPlayDir);
      if (updatedPlayers.length === 2) {
        turnsToAdvance = 0;
      }
    } else if (card.value === 'skip') {
      turnsToAdvance = 2;
    } else if (card.value === 'draw2') {
      if (rules.stacking) {
        nextAccumulated += 2;
        setUnoAccumulatedDrawCount(nextAccumulated);
        turnsToAdvance = 1;
      } else {
        const nextIdx = (playerIdx + currentPlayDir + updatedPlayers.length) % updatedPlayers.length;
        const targetPlayer = updatedPlayers[nextIdx];
        let pile = [...currentDrawPile];
        if (pile.length < 2) {
          pile = refillDrawPile(nextDiscardPile);
        }
        targetPlayer.cards.push(...pile.splice(0, 2));
        targetPlayer.safeUno = false;
        setUnoDrawPile(pile);
        ioToSystemChat(`${targetPlayer.name} drew 2 cards and turn is skipped.`);
        turnsToAdvance = 2;
      }
    } else if (card.value === 'wild4') {
      if (rules.stacking) {
        nextAccumulated += 4;
        setUnoAccumulatedDrawCount(nextAccumulated);
        turnsToAdvance = 1;
      } else {
        const nextIdx = (playerIdx + currentPlayDir + updatedPlayers.length) % updatedPlayers.length;
        const targetPlayer = updatedPlayers[nextIdx];
        let pile = [...currentDrawPile];
        if (pile.length < 4) {
          pile = refillDrawPile(nextDiscardPile);
        }
        targetPlayer.cards.push(...pile.splice(0, 4));
        targetPlayer.safeUno = false;
        setUnoDrawPile(pile);
        ioToSystemChat(`${targetPlayer.name} drew 4 cards and turn is skipped.`);
        turnsToAdvance = 2;
      }
    }

    let nextTurn = playerIdx;
    if (turnsToAdvance > 0) {
      for (let i = 0; i < turnsToAdvance; i++) {
        nextTurn = (nextTurn + nextPlayDir + updatedPlayers.length) % updatedPlayers.length;
      }
    }

    setPlayers(updatedPlayers);
    setTurnIndex(nextTurn);
  };

  const drawCardUnoSingle = () => {
    const {
      players: currentPlayers,
      turnIndex: currentTurnIdx,
      unoPlayDirection: currentPlayDir,
      unoAccumulatedDrawCount: currentAccumulated,
      unoDiscardPile: currentDiscardPile,
      unoDrawPile: currentDrawPile,
    } = stateRef.current;

    const currentPlayer = currentPlayers[currentTurnIdx];
    if (!currentPlayer) return;

    let pile = [...currentDrawPile];
    if (pile.length < 5) {
      pile = refillDrawPile(currentDiscardPile);
    }

    if (currentAccumulated > 0) {
      const drawn = pile.splice(0, currentAccumulated);
      const updatedPlayers = currentPlayers.map((p, idx) => {
        if (idx === currentTurnIdx) {
          return {
            ...p,
            cards: [...p.cards, ...drawn],
            safeUno: false,
          };
        }
        return p;
      });

      setPlayers(updatedPlayers);
      setUnoDrawPile(pile);
      setUnoAccumulatedDrawCount(0);
      ioToSystemChat(`${currentPlayer.name} drew ${currentAccumulated} cards (stack penalty) and turn is skipped.`);

      const nextTurn = (currentTurnIdx + currentPlayDir + currentPlayers.length) % currentPlayers.length;
      setTurnIndex(nextTurn);
      return;
    }

    if (rules.drawTillPlay) {
      const drawnCards: UnoCard[] = [];
      let foundPlayable = false;

      while (!foundPlayable && pile.length > 0) {
        const card = pile.pop()!;
        drawnCards.push(card);

        const matchesColor = card.color === 'wild' || card.color === stateRef.current.unoCurrentColor;
        const matchesValue = card.value === stateRef.current.unoCurrentValue;
        if (matchesColor || matchesValue) {
          foundPlayable = true;
        }

        if (pile.length === 0) {
          pile = refillDrawPile(stateRef.current.unoDiscardPile);
        }
      }

      const updatedPlayers = currentPlayers.map((p, idx) => {
        if (idx === currentTurnIdx) {
          return {
            ...p,
            cards: [...p.cards, ...drawnCards],
            safeUno: false,
          };
        }
        return p;
      });

      setPlayers(updatedPlayers);
      setUnoDrawPile(pile);
      ioToSystemChat(`${currentPlayer.name} drew ${drawnCards.length} card(s) until finding a play.`);
    } else {
      const card = pile.pop()!;
      const updatedPlayers = currentPlayers.map((p, idx) => {
        if (idx === currentTurnIdx) {
          return {
            ...p,
            cards: [...p.cards, card],
            safeUno: false,
          };
        }
        return p;
      });

      setPlayers(updatedPlayers);
      setUnoDrawPile(pile);
      ioToSystemChat(`${currentPlayer.name} drew a card.`);

      // Auto-advance turn if drawn card is NOT playable (no manual pass needed in Uno)
      const drawnCard = card;
      const matchesColor = drawnCard.color === 'wild' || drawnCard.color === stateRef.current.unoCurrentColor;
      const matchesValue = drawnCard.value === stateRef.current.unoCurrentValue;
      if (!matchesColor && !matchesValue) {
        const nextTurn = (currentTurnIdx + currentPlayDir + currentPlayers.length) % currentPlayers.length;
        setTurnIndex(nextTurn);
      }
      // If the card IS playable, leave the turn on the player so they can choose to play it
    }
  };

  const passTurnUnoSingle = () => {
    const {
      players: currentPlayers,
      turnIndex: currentTurnIdx,
      unoPlayDirection: currentPlayDir,
    } = stateRef.current;

    const currentPlayer = currentPlayers[currentTurnIdx];
    if (!currentPlayer) return;

    ioToSystemChat(`${currentPlayer.name} passed.`);
    const nextTurn = (currentTurnIdx + currentPlayDir + currentPlayers.length) % currentPlayers.length;
    setTurnIndex(nextTurn);
  };

  const unoCallUnoSingle = () => {
    const { players: currentPlayers } = stateRef.current;
    const updated = currentPlayers.map((p) => {
      if (p.id === 'local_user' && p.cards.length <= 2) {
        return { ...p, safeUno: true };
      }
      return p;
    });

    const localP = currentPlayers.find(p => p.id === 'local_user');
    if (localP && localP.cards.length <= 2) {
      setPlayers(updated);
      ioToSystemChat(`📣 UNO! ${localP.name} is down to their last card!`);
    }
  };

  const unoChallengeUnoSingle = (targetPlayerId: string, challengerId: string = 'local_user') => {
    const { players: currentPlayers, unoDiscardPile: currentDiscardPile, unoDrawPile: currentDrawPile } = stateRef.current;
    const target = currentPlayers.find((p) => p.id === targetPlayerId);
    if (!target) return;

    if (target.cards.length === 1 && !target.safeUno) {
      let pile = [...currentDrawPile];
      if (pile.length < 2) {
        pile = refillDrawPile(currentDiscardPile);
      }

      const drawn = pile.splice(0, 2);
      const updated = currentPlayers.map((p) => {
        if (p.id === targetPlayerId) {
          return {
            ...p,
            cards: [...p.cards, ...drawn],
            safeUno: true,
          };
        }
        return p;
      });

      setPlayers(updated);
      setUnoDrawPile(pile);
      setLastUnoChallenge({
        challengerId,
        targetPlayerId,
        timestamp: Date.now()
      });
      const challengerName = challengerId === 'local_user' ? 'local_user' : (currentPlayers.find(p => p.id === challengerId)?.name || 'Bot');
      const textChallengerName = challengerName === 'local_user' ? 'You' : challengerName;
      ioToSystemChat(`👮 Caught! ${textChallengerName} caught ${target.name} not calling UNO! Penalty: drew 2 cards.`);
    }
  };

  const swapHandUnoSingle = (targetPlayerId: string) => {
    const {
      players: currentPlayers,
      unoSevenSwappingPlayerId: swappingPlayerId,
      unoPlayDirection: currentPlayDir,
    } = stateRef.current;

    if (!swappingPlayerId) return;

    const requester = currentPlayers.find((p) => p.id === swappingPlayerId);
    const target = currentPlayers.find((p) => p.id === targetPlayerId);
    if (!requester || !target) return;

    const tempCards = [...requester.cards];
    const requesterIdx = currentPlayers.indexOf(requester);
    const targetIdx = currentPlayers.indexOf(target);

    const updated = currentPlayers.map((p, idx) => {
      if (idx === requesterIdx) {
        return {
          ...p,
          cards: [...target.cards],
          safeUno: false,
        };
      }
      if (idx === targetIdx) {
        return {
          ...p,
          cards: tempCards,
          safeUno: false,
        };
      }
      return p;
    });

    setPlayers(updated);
    setUnoSevenSwappingPlayerId(null);
    setUnoLastSevenSwap({
      requesterId: swappingPlayerId,
      targetId: targetPlayerId,
    });

    ioToSystemChat(`🤝 ${requester.name} swapped hands with ${target.name}!`);

    const nextTurn = (requesterIdx + currentPlayDir + currentPlayers.length) % currentPlayers.length;
    setTurnIndex(nextTurn);
  };

  const handleRoundOverUnoSingle = (finalPlayers: Player[]) => {
    setGameState('roundover');

    const winner = finalPlayers.find((p) => p.cards.length === 0);
    const winnerName = winner ? winner.name : 'Unknown';

    ioToSystemChat(`🎉 ${winnerName} won the round! 🎉`);

    let roundPoints = 0;
    finalPlayers.forEach((p) => {
      if (winner && p.id !== winner.id) {
        let handPoints = 0;
        p.cards.forEach((c) => {
          if (c) {
            if (c.color === 'wild') {
              handPoints += 50;
            } else if (['skip', 'reverse', 'draw2'].includes(c.value)) {
              handPoints += 20;
            } else {
              const val = parseInt(c.value, 10);
              handPoints += isNaN(val) ? 0 : val;
            }
          }
        });
        roundPoints += handPoints;
      }
    });

    const scoredPlayers = finalPlayers.map((p) => {
      if (winner && p.id === winner.id) {
        return {
          ...p,
          score: p.score + roundPoints,
          roundPoints: roundPoints,
        };
      }
      return {
        ...p,
        roundPoints: 0,
      };
    });

    setPlayers(scoredPlayers);

    const targetPoints = rules.pointsToWin || 250;
    const someoneWon = scoredPlayers.some((p) => p.score >= targetPoints);
    if (someoneWon) {
      setGameState('gameover');
    }
  };

  const restartSinglePlayerUnoGameRound = () => {
    if (gameState === 'gameover') {
      const reset = players.map((p) => ({ ...p, score: 0, roundPoints: 0 }));
      setPlayers(reset);
    }
    setGameState('lobby');
    setTimeout(() => {
      startSinglePlayerUnoGame();
    }, 100);
  };

  const ioToSystemChat = (text: string) => {
    const sysMsg: ChatMessage = {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    };
    setChatMessages((prev) => [...prev, sysMsg]);
  };

  const shuffleLocalDeck = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const updateNetWorthLocal = (playersList: Player[], boardList: TileState[]) => {
    return playersList.map(p => {
      let val = p.money || 0;
      boardList.forEach(tile => {
        if (tile.owner === p.id) {
          if (tile.mortgaged) {
            val += tile.mortgageValue || 0;
          } else {
            val += tile.price || 0;
            if (tile.houses > 0) {
              val += tile.houses * (tile.housePrice || 0);
            }
          }
        }
      });
      return { ...p, netWorth: val, score: val };
    });
  };

  const ownsMonopolyLocal = (board: TileState[], color: string, ownerId: string) => {
    const total = board.filter(t => t.type === 'property' && t.color === color).length;
    const owned = board.filter(t => t.type === 'property' && t.color === color && t.owner === ownerId).length;
    return total > 0 && total === owned;
  };

  const calculateRentLocal = (tile: TileState, board: TileState[], diceSum: number, doubleMultiplier = false) => {
    let base = 0;
    if (tile.type === 'property') {
      const isMonopoly = ownsMonopolyLocal(board, tile.color || '', tile.owner || '');
      if (tile.houses === 0) {
        base = isMonopoly ? (tile.rent?.[0] || 0) * 2 : (tile.rent?.[0] || 0);
      } else {
        base = tile.rent?.[tile.houses] || 0;
      }
    } else if (tile.type === 'railroad') {
      const count = board.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
      const baseRent = tile.rent?.[Math.min(count - 1, 3)] || 25;
      base = doubleMultiplier ? baseRent * 2 : baseRent;
    } else if (tile.type === 'utility') {
      const count = board.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
      const mult = count === 2 ? 10 : 4;
      const finalMult = doubleMultiplier ? 10 : mult;
      base = diceSum * finalMult;
    }
    // Festival doubles rent for 3 turns
    if ((tile as any).festivalTurns && (tile as any).festivalTurns > 0) {
      base = base * 2;
    }
    return base;
  };

  const setEndTurnPhaseSingle = (p: Player, playersList: Player[]) => {
    if (p.inJail) {
      let nextTurn = turnIndex;
      const n = playersList.length;
      for (let i = 0; i < n; i++) {
        nextTurn = (nextTurn + 1) % n;
        if (!playersList[nextTurn].bankrupt) break;
      }
      setTurnIndex(nextTurn);
      setMonopolyPhase('roll');
      playersList.forEach((pl, idx) => {
        if (idx === turnIndex || idx === nextTurn) {
          pl.rollCount = 0;
          pl.doublesRolled = false;
        }
      });
      setPlayers(prev => prev.map((pl, idx) => {
        if (idx === turnIndex || idx === nextTurn) {
          return { ...pl, rollCount: 0, doublesRolled: false };
        }
        return pl;
      }));
    } else if (p.doublesRolled && !p.bankrupt) {
      const targetPl = playersList.find(pl => pl.id === p.id);
      if (targetPl) {
        targetPl.doublesRolled = false;
      }
      setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, doublesRolled: false } : pl));
      setMonopolyPhase('roll');
      ioToSystemChat(`🎲 Doubles! ${p.name} gets to roll again.`);
    } else {
      setMonopolyPhase('end_turn');
    }
  };

  const resolveLandedSpaceSingle = (
    playersList: Player[],
    boardList: TileState[],
    player: Player,
    diceSum: number,
    chanceDeck: any[],
    chestDeck: any[]
  ) => {
    const tile = boardList[player.position!];
    const updatePlayersAndBoard = (nextPlayers: Player[], nextBoard: TileState[]) => {
      const freshPlayers = updateNetWorthLocal(nextPlayers, nextBoard);
      setPlayers(freshPlayers);
      setMonopolyBoard(nextBoard);
    };

    if (tile.type === 'go') {
      setEndTurnPhaseSingle(player, playersList);
      updatePlayersAndBoard(playersList, boardList);
      return;
    }

    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      if (tile.owner === null) {
        setMonopolyPhase('action');
        updatePlayersAndBoard(playersList, boardList);
      } else if (tile.owner === player.id) {
        // Get Rich: offer instant build on landing
        if (rules.ruleset === 'Get Rich' && tile.type === 'property' && tile.houses < 5) {
          setMonopolyPhase('landed_build');
          setMonopolyLandedBuildMaxHouses(tile.houses === 4 ? 5 : 4);
          updatePlayersAndBoard(playersList, boardList);
        } else {
          setEndTurnPhaseSingle(player, playersList);
          updatePlayersAndBoard(playersList, boardList);
        }
      } else if (tile.mortgaged) {
        ioToSystemChat(`${player.name} landed on ${tile.name} (Mortgaged by owner). No rent paid.`);
        setEndTurnPhaseSingle(player, playersList);
        updatePlayersAndBoard(playersList, boardList);
      } else {
        const owner = playersList.find(p => p.id === tile.owner)!;
        const rent = calculateRentLocal(tile, boardList, diceSum);
        ioToSystemChat(`${player.name} landed on ${tile.name} and owes ${owner.name} $${rent} rent.`);

        // Get Rich: Angel Card can skip rent
        if (rules.ruleset === 'Get Rich' && (player as any).angelCards > 0) {
          setMonopolyPendingRent({ fromId: player.id, toId: owner.id, amount: rent });
          setMonopolyPhase('use_angel_rent');
          updatePlayersAndBoard(playersList, boardList);
          return;
        }

        const moneyAfterRent = player.money! - rent;

        if (moneyAfterRent >= 0) {
          const nextPlayers = playersList.map(p => {
            if (p.id === player.id) return { ...p, money: moneyAfterRent };
            if (p.id === owner.id) return { ...p, money: p.money! + rent };
            return p;
          });
          ioToSystemChat(`${player.name} paid $${rent} rent to ${owner.name}.`);

          let nextPhase: 'roll' | 'action' | 'jail_decision' | 'card_drawn' | 'bankrupt_decision' | 'end_turn' | 'auction' | 'festival_selection' | 'airport_selection' | 'force_acquire_decision' | 'use_angel_rent' | 'use_angel_force' | 'landed_build' = 'end_turn';
          const tileWorth = (tile.price || 0) + (tile.houses || 0) * (tile.housePrice || 0);

          if (rules.ruleset === 'Get Rich' && tile.houses < 5 && moneyAfterRent >= tileWorth) {
            setMonopolyPendingForceAcquire({ byId: player.id, tileIndex: tile.index, worth: tileWorth });
            if ((owner as any).angelCards > 0) {
              nextPhase = 'use_angel_force';
            } else {
              nextPhase = 'force_acquire_decision';
            }
            setMonopolyPhase(nextPhase);
            updatePlayersAndBoard(nextPlayers, boardList);
          } else {
            const nextActivePlayer = nextPlayers.find(p => p.id === player.id)!;
            setEndTurnPhaseSingle(nextActivePlayer, nextPlayers);
            updatePlayersAndBoard(nextPlayers, boardList);
          }
        } else {
          triggerPaymentSingle(playersList, boardList, player, owner, rent);
        }
      }
      return;
    }

    if (tile.type === 'tax') {
      const tax = tile.price || 0;
      ioToSystemChat(`${player.name} landed on ${tile.name} and owes the bank $${tax}.`);
      triggerPaymentSingle(playersList, boardList, player, null, tax);
      return;
    }

    if (tile.type === 'jail') {
      setEndTurnPhaseSingle(player, playersList);
      updatePlayersAndBoard(playersList, boardList);
      return;
    }

    if (tile.type === 'parking') {
      if (rules.ruleset === 'Get Rich') {
        const ownedProps = boardList.filter(t =>
          (t.type === 'property' || t.type === 'railroad' || t.type === 'utility') && t.owner === player.id
        );
        if (ownedProps.length > 0) {
          ioToSystemChat(`🎉 ${player.name} landed on Festival! Choose a property to double rent for 3 turns.`);
          setMonopolyPhase('festival_selection');
          updatePlayersAndBoard(playersList, boardList);
        } else {
          ioToSystemChat(`🎉 ${player.name} landed on Festival! No properties to boost.`);
          setEndTurnPhaseSingle(player, playersList);
          updatePlayersAndBoard(playersList, boardList);
        }
      } else {
        ioToSystemChat(`${player.name} relaxes at Free Parking!`);
        setEndTurnPhaseSingle(player, playersList);
        updatePlayersAndBoard(playersList, boardList);
      }
      return;
    }

    if (tile.type === 'gotojail') {
      if (rules.ruleset === 'Get Rich') {
        if (player.money! >= 100) {
          ioToSystemChat(`✈️ ${player.name} landed on the Airport! Pay $100 to fly to any tile.`);
          setMonopolyPhase('airport_selection');
          updatePlayersAndBoard(playersList, boardList);
        } else {
          ioToSystemChat(`✈️ ${player.name} landed on the Airport but can't afford the $100 fare.`);
          setEndTurnPhaseSingle(player, playersList);
          updatePlayersAndBoard(playersList, boardList);
        }
        return;
      }
      const nextPlayers = playersList.map(p => {
        if (p.id === player.id) {
          return {
            ...p,
            position: 10,
            inJail: true,
            jailTurns: 0,
            rollCount: 0,
            doublesRolled: false,
          };
        }
        return p;
      });
      ioToSystemChat(`👮 ${player.name} was sent directly to Jail!`);
      const updatedP = nextPlayers.find(p => p.id === player.id)!;
      setEndTurnPhaseSingle(updatedP, nextPlayers);
      updatePlayersAndBoard(nextPlayers, boardList);
      return;
    }

    if (tile.type === 'chance' || tile.type === 'chest') {
      const isGetRich = rules.ruleset === 'Get Rich';
      let allCards = tile.type === 'chance' ? LOCAL_CHANCE_CARDS : LOCAL_CHEST_CARDS;
      if (!isGetRich) {
        allCards = allCards.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');
      }
      const deck = tile.type === 'chance' ? chanceDeck : chestDeck;
      const nextDeck = [...deck];
      let card: any;
      if (nextDeck.length === 0) {
        const refilled = shuffleLocalDeck(allCards);
        card = refilled.pop()!;
        if (tile.type === 'chance') setMonopolyChanceDeck(refilled);
        else setMonopolyChestDeck(refilled);
      } else {
        // Filter out Get Rich exclusive cards from existing deck if needed
        const filteredDeck = isGetRich ? nextDeck : nextDeck.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');
        if (filteredDeck.length === 0) {
          const refilled = shuffleLocalDeck(allCards);
          card = refilled.pop()!;
          if (tile.type === 'chance') setMonopolyChanceDeck(refilled);
          else setMonopolyChestDeck(refilled);
        } else {
          card = filteredDeck.pop()!;
          if (tile.type === 'chance') setMonopolyChanceDeck(filteredDeck);
          else setMonopolyChestDeck(filteredDeck);
        }
      }
      setMonopolyCurrentCard(card);
      setMonopolyCardType(tile.type);
      setMonopolyPhase('card_drawn');
      updatePlayersAndBoard(playersList, boardList);
      ioToSystemChat(`✉️ ${player.name} drew a ${tile.type.toUpperCase()} card: "${card.text}"`);
      return;
    }
  };

  const triggerPaymentSingle = (
    playersList: Player[],
    boardList: TileState[],
    debtor: Player,
    recipient: Player | null,
    amount: number
  ) => {
    const updatePlayersAndBoard = (nextPlayers: Player[], nextBoard: TileState[]) => {
      const freshPlayers = updateNetWorthLocal(nextPlayers, nextBoard);
      setPlayers(freshPlayers);
      setMonopolyBoard(nextBoard);
    };

    if (debtor.money! >= amount) {
      const nextPlayers = playersList.map(p => {
        if (p.id === debtor.id) {
          return { ...p, money: p.money! - amount };
        }
        if (recipient && p.id === recipient.id) {
          return { ...p, money: p.money! + amount };
        }
        return p;
      });
      if (recipient) {
        ioToSystemChat(`${debtor.name} paid $${amount} rent to ${recipient.name}.`);
      } else {
        ioToSystemChat(`${debtor.name} paid $${amount} tax to the bank.`);
      }
      setEndTurnPhaseSingle(debtor, nextPlayers);
      updatePlayersAndBoard(nextPlayers, boardList);
    } else {
      setMonopolyActiveDebt({
        from: debtor.id,
        to: recipient ? recipient.id : 'bank',
        amountValue: amount
      });
      setMonopolyPhase('bankrupt_decision');
      updatePlayersAndBoard(playersList, boardList);
      ioToSystemChat(`🚨 ${debtor.name} is in debt! Needs to raise $${amount - debtor.money!} to pay the debt.`);
    }
  };

  const resolveDebtPaymentSingle = (
    playersList: Player[],
    boardList: TileState[],
    debtDetails: any
  ) => {
    const debtor = playersList.find(p => p.id === debtDetails.from)!;
    const recipient = debtDetails.to === 'bank' ? null : playersList.find(p => p.id === debtDetails.to);
    const amount = debtDetails.amountValue;

    const nextPlayers = playersList.map(p => {
      if (p.id === debtor.id) {
        return { ...p, money: p.money! - amount };
      }
      if (recipient && p.id === recipient.id) {
        return { ...p, money: p.money! + amount };
      }
      return p;
    });

    if (recipient) {
      ioToSystemChat(`✅ Debt resolved. ${debtor.name} paid $${amount} to ${recipient.name}.`);
    } else {
      ioToSystemChat(`✅ Debt resolved. ${debtor.name} paid $${amount} to the bank.`);
    }

    setMonopolyActiveDebt(null);
    setEndTurnPhaseSingle(debtor, nextPlayers);

    const freshPlayers = updateNetWorthLocal(nextPlayers, boardList);
    setPlayers(freshPlayers);
    setMonopolyBoard(boardList);
  };

  const resolveCardActionSingle = (
    playersList: Player[],
    boardList: TileState[],
    player: Player,
    card: any,
    _cardType: string,
    chanceDeck: any[],
    chestDeck: any[]
  ) => {
    setMonopolyCurrentCard(null);
    setMonopolyCardType(null);

    const updatedPlayers = playersList.map(p => p.id === player.id ? { ...p } : p);
    const updatedPlayer = updatedPlayers.find(p => p.id === player.id)!;
    const updatePlayersAndBoard = (nextPlayers: Player[], nextBoard: TileState[]) => {
      const freshPlayers = updateNetWorthLocal(nextPlayers, nextBoard);
      setPlayers(freshPlayers);
      setMonopolyBoard(nextBoard);
    };

    if (card.action === 'move') {
      const oldPos = updatedPlayer.position || 0;
      const target = card.target;
      updatedPlayer.position = target;

      let passGoText = '';
      if (target < oldPos) {
        updatedPlayer.money = (updatedPlayer.money || 0) + 200;
        passGoText = ` and collected $200 for passing GO`;
      }
      ioToSystemChat(`✉️ Card Action: Advanced to ${boardList[target].name}${passGoText}.`);
      resolveLandedSpaceSingle(updatedPlayers, boardList, updatedPlayer, 7, chanceDeck, chestDeck);
      return;
    }

    if (card.action === 'give_money') {
      updatedPlayer.money = (updatedPlayer.money || 0) + card.amount;
      ioToSystemChat(`✉️ Card Action: Received $${card.amount}.`);
      setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      updatePlayersAndBoard(updatedPlayers, boardList);
      return;
    }

    if (card.action === 'take_money') {
      ioToSystemChat(`✉️ Card Action: Owed $${card.amount} fee.`);
      triggerPaymentSingle(updatedPlayers, boardList, updatedPlayer, null, card.amount);
      return;
    }

    if (card.action === 'jail_free') {
      updatedPlayer.getOutOfJailCards = (updatedPlayer.getOutOfJailCards || 0) + 1;
      ioToSystemChat(`✉️ Card Action: Obtained Get Out of Jail Free card.`);
      setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      updatePlayersAndBoard(updatedPlayers, boardList);
      return;
    }

    if (card.action === 'goto_jail') {
      updatedPlayer.position = 10;
      updatedPlayer.inJail = true;
      updatedPlayer.jailTurns = 0;
      updatedPlayer.rollCount = 0;
      updatedPlayer.doublesRolled = false;
      ioToSystemChat(`👮 Card Action: Sent directly to JAIL!`);
      setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      updatePlayersAndBoard(updatedPlayers, boardList);
      return;
    }

    if (card.action === 'back_spaces') {
      const oldPos = updatedPlayer.position || 0;
      const nextPos = (oldPos - card.amount + 40) % 40;
      updatedPlayer.position = nextPos;
      ioToSystemChat(`✉️ Card Action: Went back ${card.amount} spaces to ${boardList[nextPos].name}.`);
      resolveLandedSpaceSingle(updatedPlayers, boardList, updatedPlayer, 7, chanceDeck, chestDeck);
      return;
    }

    if (card.action === 'nearest_railroad') {
      const pos = updatedPlayer.position || 0;
      const rrPositions = [5, 15, 25, 35];
      let nextRR = rrPositions.find(p => p > pos);
      if (nextRR === undefined) nextRR = 5;

      let passGoText = '';
      if (nextRR < pos) {
        updatedPlayer.money = (updatedPlayer.money || 0) + 200;
        passGoText = ` and collected $200 for passing GO`;
      }
      updatedPlayer.position = nextRR;
      ioToSystemChat(`✉️ Card Action: Advanced to nearest railroad: ${boardList[nextRR].name}${passGoText}.`);

      const tile = boardList[nextRR];
      if (tile.owner === null) {
        setMonopolyPhase('action');
        updatePlayersAndBoard(updatedPlayers, boardList);
      } else if (tile.owner === updatedPlayer.id) {
        setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
        updatePlayersAndBoard(updatedPlayers, boardList);
      } else {
        const owner = updatedPlayers.find(p => p.id === tile.owner)!;
        const baseRent = calculateRentLocal(tile, boardList, 7);
        const rent = baseRent * 2;
        ioToSystemChat(`${updatedPlayer.name} landed on railroad owned by ${owner.name} (Rent is doubled: $${rent}).`);
        triggerPaymentSingle(updatedPlayers, boardList, updatedPlayer, owner, rent);
      }
      return;
    }

    if (card.action === 'nearest_utility') {
      const pos = updatedPlayer.position || 0;
      const utilPositions = [12, 28];
      let nextUtil = utilPositions.find(p => p > pos);
      if (nextUtil === undefined) nextUtil = 12;

      let passGoText = '';
      if (nextUtil < pos) {
        updatedPlayer.money = (updatedPlayer.money || 0) + 200;
        passGoText = ` and collected $200 for passing GO`;
      }
      updatedPlayer.position = nextUtil;
      ioToSystemChat(`✉️ Card Action: Advanced to nearest utility: ${boardList[nextUtil].name}${passGoText}.`);

      const tile = boardList[nextUtil];
      if (tile.owner === null) {
        setMonopolyPhase('action');
        updatePlayersAndBoard(updatedPlayers, boardList);
      } else if (tile.owner === updatedPlayer.id) {
        setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
        updatePlayersAndBoard(updatedPlayers, boardList);
      } else {
        const owner = updatedPlayers.find(p => p.id === tile.owner)!;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;
        const rent = sum * 10;
        setMonopolyDice([d1, d2]);
        ioToSystemChat(`🎲 Rolled ${d1}+${d2}=${sum} for Utility multiplier rent.`);
        ioToSystemChat(`${updatedPlayer.name} landed on utility owned by ${owner.name} and owes 10x dice = $${rent}.`);
        triggerPaymentSingle(updatedPlayers, boardList, updatedPlayer, owner, rent);
      }
      return;
    }

    if (card.action === 'pay_each') {
      const activeOthers = updatedPlayers.filter(p => !p.bankrupt && p.id !== updatedPlayer.id);
      const totalCost = card.amount * activeOthers.length;
      ioToSystemChat(`✉️ Card Action: Pay $${card.amount} to every player (Total: $${totalCost}).`);

      const nextPlayers = updatedPlayers.map(p => {
        if (p.id === updatedPlayer.id) {
          return { ...p, money: p.money! - totalCost };
        }
        if (!p.bankrupt) {
          return { ...p, money: p.money! + card.amount };
        }
        return p;
      });

      const nextDebtor = nextPlayers.find(p => p.id === updatedPlayer.id)!;
      if (nextDebtor.money! >= 0) {
        setEndTurnPhaseSingle(updatedPlayer, nextPlayers);
        updatePlayersAndBoard(nextPlayers, boardList);
      } else {
        setMonopolyActiveDebt({
          from: updatedPlayer.id,
          to: 'bank',
          amountValue: totalCost
        });
        setMonopolyPhase('bankrupt_decision');
        updatePlayersAndBoard(updatedPlayers, boardList);
      }
      return;
    }

    if (card.action === 'collect_each') {
      const activeOthers = updatedPlayers.filter(p => !p.bankrupt && p.id !== updatedPlayer.id);
      ioToSystemChat(`✉️ Card Action: Collect $${card.amount} from every player.`);

      const nextPlayers = updatedPlayers.map(p => {
        if (p.id === updatedPlayer.id) {
          return { ...p, money: p.money! + (card.amount * activeOthers.length) };
        }
        if (!p.bankrupt) {
          return { ...p, money: Math.max(0, p.money! - card.amount) };
        }
        return p;
      });

      setEndTurnPhaseSingle(updatedPlayer, nextPlayers);
      updatePlayersAndBoard(nextPlayers, boardList);
      return;
    }

    if (card.action === 'repairs') {
      let houseCount = 0;
      let hotelCount = 0;
      boardList.forEach(t => {
        if (t.owner === updatedPlayer.id && !t.mortgaged) {
          if (t.houses === 5) hotelCount++;
          else houseCount += t.houses;
        }
      });
      const cost = (houseCount * card.houseCost) + (hotelCount * card.hotelCost);
      ioToSystemChat(`✉️ Card Action: Repairs assessed. Houses: ${houseCount}, Hotels: ${hotelCount}. Total Cost: $${cost}.`);
      triggerPaymentSingle(updatedPlayers, boardList, updatedPlayer, null, cost);
      return;
    }

    // Get Rich: Odd/Even card
    if (card.action === 'give_odd_even') {
      (updatedPlayer as any).oddEvenCards = Math.min(((updatedPlayer as any).oddEvenCards || 0) + 1, 1);
      ioToSystemChat(`🎯 ${updatedPlayer.name} received an Odd/Even Card!`);
      setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      updatePlayersAndBoard(updatedPlayers, boardList);
      return;
    }

    // Get Rich: Angel card
    if (card.action === 'give_angel') {
      (updatedPlayer as any).angelCards = Math.min(((updatedPlayer as any).angelCards || 0) + 1, 1);
      ioToSystemChat(`😇 ${updatedPlayer.name} received an Angel Card!`);
      setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      updatePlayersAndBoard(updatedPlayers, boardList);
      return;
    }

    setMonopolyPhase('end_turn');
    updatePlayersAndBoard(updatedPlayers, boardList);
  };

  const startSinglePlayerMonopolyGame = () => {
    sfx.playDeal();

    const currentPlayers = [...players];
    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
    ] as AvatarConfig[];

    while (currentPlayers.length < 4) {
      const existingNames = currentPlayers.map((p) => p.name);
      const unusedNames = BOT_NAMES.filter((n) => !existingNames.includes(n));
      const botName = unusedNames.length > 0
        ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
        : `Bot ${currentPlayers.length + 1}`;
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

    const isGetRich = rules.ruleset === 'Get Rich';
    const shuffledChance = shuffleLocalDeck(LOCAL_CHANCE_CARDS);
    const shuffledChest = shuffleLocalDeck(LOCAL_CHEST_CARDS);

    const initialBoard = LOCAL_BOARD_TILES.map(t => ({
      ...t,
      owner: null as string | null,
      houses: 0,
      mortgaged: false,
      festivalTurns: 0
    })) as TileState[];

    const startMoney = rules.startingCash ? Number(rules.startingCash) : 1500;
    const initializedPlayers = currentPlayers.map((p) => ({
      ...p,
      money: startMoney,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      lastRoll: [1, 1],
      rollCount: 0,
      netWorth: startMoney,
      passed: false,
      lastPlay: null,
      // Get Rich consumable cards
      oddEvenCards: isGetRich ? 0 : undefined,
      angelCards: isGetRich ? 0 : undefined,
      score: startMoney,
    }));

    setMonopolyTurnCount(0);
    setPlayers(initializedPlayers);
    setMonopolyBoard(initialBoard);
    setMonopolyDice([1, 1]);
    setMonopolyRollId(null);
    setMonopolyPhase('roll');
    setMonopolyCurrentCard(null);
    setMonopolyCardType(null);
    setMonopolyActiveDebt(null);
    setMonopolyChanceDeck(shuffledChance);
    setMonopolyChestDeck(shuffledChest);
    setTurnIndex(0);
    setGameState('playing');
    setScreen('table');

    const initialMsgs = [
      {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: '🎩 Monopoly Game Started! Good luck players! 🎲',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      },
      ...initializedPlayers.map(p => ({
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: `${p.name} joined the table.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      }))
    ];
    setChatMessages(initialMsgs);
  };

  const restartSinglePlayerMonopolyGameRound = () => {
    setGameState('lobby');
    setTimeout(() => {
      startSinglePlayerMonopolyGame();
    }, 100);
  };

  const resumeAfterAuctionSingle = (activePlayer: Player, playersList: Player[], boardList: TileState[]) => {
    setMonopolyAuctionState(null);
    if (activePlayer.doublesRolled) {
      const updatedPlayers = playersList.map(p => {
        if (p.id === activePlayer.id) {
          return { ...p, doublesRolled: false };
        }
        return p;
      });
      setPlayers(updatedPlayers);
      setMonopolyBoard(boardList);
      setMonopolyPhase('roll');
      ioToSystemChat(`🎲 Doubles! ${activePlayer.name} gets to roll again.`);
    } else {
      setPlayers(playersList);
      setMonopolyBoard(boardList);
      setEndTurnPhaseSingle(activePlayer, playersList);
    }
  };

  const handleMonopolyActionMultiplayer = useCallback((action: string, payload?: any) => {
    if (isMonopolyAnimating && action !== 'leave' && action !== 'end-turn') return;
    socketRef.current?.emit('monopoly-action', { roomCode, action, payload });
  }, [isMonopolyAnimating, roomCode]);

  const checkTurnLimitSingle = (nextPlayers: Player[], currentTurnCount: number) => {
    const limit = rules.turnLimit ? Number(rules.turnLimit) : 0;
    if (limit > 0 && currentTurnCount >= limit) {
      setGameState('gameover');

      const activePlayers = nextPlayers.filter(p => !p.bankrupt);
      activePlayers.sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));
      const winner = activePlayers[0];

      ioToSystemChat(`⏱️ Turn limit of ${limit} reached!`);
      ioToSystemChat(`🏆 ${winner.name} wins with a net worth of $${winner.netWorth || 0}! 🏆`);

      const sortedAll = [...nextPlayers];
      sortedAll.sort((a, b) => {
        if (a.bankrupt && !b.bankrupt) return 1;
        if (!a.bankrupt && b.bankrupt) return -1;
        return (b.netWorth || 0) - (a.netWorth || 0);
      });

      const rankedPlayers = nextPlayers.map(p => {
        const rank = sortedAll.findIndex(sa => sa.id === p.id) + 1;
        return { ...p, finishRank: rank, score: p.netWorth || 0 };
      });

      setPlayers(rankedPlayers);
      return true;
    }
    return false;
  };

  const handleMonopolyActionSingle = (action: string, payload?: any) => {
    if (isMonopolyAnimating && action !== 'leave' && action !== 'end-turn') return;

    const {
      players: currentPlayers,
      turnIndex: currentTurnIdx,
      monopolyBoard: currentBoard,
      monopolyPhase: currentPhase,
      monopolyCurrentCard: currentCard,
      monopolyCardType: currentCardType,
      monopolyActiveDebt: currentActiveDebt,
      monopolyChanceDeck: chanceDeck,
      monopolyChestDeck: chestDeck
    } = stateRef.current;

    const currentPlayer = currentPlayers[currentTurnIdx];
    if (!currentPlayer || currentPlayer.bankrupt) return;

    const updatePlayersAndBoard = (nextPlayers: Player[], nextBoard: TileState[]) => {
      const freshPlayers = updateNetWorthLocal(nextPlayers, nextBoard);
      setPlayers(freshPlayers);
      setMonopolyBoard(nextBoard);
    };

    if (action === 'roll-dice') {
      if (currentPhase !== 'roll' || currentPlayer.inJail) return;

      const isGetRich = rules.ruleset === 'Get Rich';
      let d1: number, d2: number;

      if (isGetRich && payload && payload.power !== undefined) {
        const power = payload.power as number;
        let minSum: number, maxSum: number;
        if (power <= 33) { minSum = 2; maxSum = 4; }
        else if (power <= 66) { minSum = 5; maxSum = 8; }
        else { minSum = 9; maxSum = 12; }

        const oddEvenChoice = payload.oddEvenChoice || null;
        // Consume the Odd/Even card if used (optimistic update - server will confirm)
        if (oddEvenChoice && (currentPlayer as any).oddEvenCards > 0) {
          setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, oddEvenCards: Math.max(0, ((p as any).oddEvenCards || 1) - 1) } : p));
        }

        let attempts = 0;
        do {
          d1 = Math.floor(Math.random() * 6) + 1;
          d2 = Math.floor(Math.random() * 6) + 1;
          const s = d1 + d2;
          const parityOk = !oddEvenChoice ||
            (oddEvenChoice === 'odd' && s % 2 === 1) ||
            (oddEvenChoice === 'even' && s % 2 === 0);
          const rangeOk = s >= minSum && s <= maxSum;
          if (rangeOk && parityOk) break;
          attempts++;
        } while (attempts < 200);
      } else {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
      }

      const sum = d1! + d2!;
      const isDoubles = d1! === d2!;

      setMonopolyDice([d1!, d2!]);
      setMonopolyRollId(Math.random().toString(36).substring(2, 9));
      setIsMonopolyAnimating(true);

      setTimeout(() => {
        const {
          players: freshPlayers,
          monopolyBoard: freshBoard,
          monopolyChanceDeck: freshChanceDeck,
          monopolyChestDeck: freshChestDeck
        } = stateRef.current;

        const freshPlayer = freshPlayers[currentTurnIdx];
        if (!freshPlayer || freshPlayer.bankrupt) {
          setIsMonopolyAnimating(false);
          return;
        }

        const updatedPlayers = freshPlayers.map(p => {
          if (p.id === freshPlayer.id) {
            const nextRollCount = isDoubles ? (p.rollCount || 0) + 1 : 0;
            return {
              ...p,
              lastRoll: [d1, d2],
              rollCount: nextRollCount,
              doublesRolled: isDoubles && nextRollCount < 3,
            };
          }
          return p;
        });
        const updatedPlayer = updatedPlayers[currentTurnIdx];

        if (updatedPlayer.rollCount === 3) {
          updatedPlayer.inJail = true;
          updatedPlayer.position = 10;
          updatedPlayer.rollCount = 0;
          updatedPlayer.doublesRolled = false;

          ioToSystemChat(`👮 ${updatedPlayer.name} rolled doubles 3 times and is sent directly to JAIL!`);
          setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
          updatePlayersAndBoard(updatedPlayers, freshBoard);
          setIsMonopolyAnimating(false);
          return;
        }

        const oldPos = updatedPlayer.position || 0;
        const newPos = (oldPos + sum) % 40;
        updatedPlayer.position = newPos;

        let passGoText = '';
        if (newPos < oldPos) {
          updatedPlayer.money = (updatedPlayer.money || 0) + 200;
          passGoText = ` and collected $200 for passing GO`;
        }

        ioToSystemChat(`🎲 ${updatedPlayer.name} rolled ${d1}+${d2}=${sum}${passGoText}.`);
        resolveLandedSpaceSingle(updatedPlayers, freshBoard, updatedPlayer, sum, freshChanceDeck, freshChestDeck);
        setIsMonopolyAnimating(false);
      }, 2200);
    }

    else if (action === 'roll-jail-doubles') {
      if (currentPhase !== 'roll') return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      const isDoubles = d1 === d2;

      setMonopolyDice([d1, d2]);
      setMonopolyRollId(Math.random().toString(36).substring(2, 9));
      setIsMonopolyAnimating(true);

      setTimeout(() => {
        const {
          players: freshPlayers,
          monopolyBoard: freshBoard,
          monopolyChanceDeck: freshChanceDeck,
          monopolyChestDeck: freshChestDeck
        } = stateRef.current;

        const freshPlayer = freshPlayers[currentTurnIdx];
        if (!freshPlayer || freshPlayer.bankrupt) {
          setIsMonopolyAnimating(false);
          return;
        }

        const updatedPlayers = freshPlayers.map(p => {
          if (p.id === freshPlayer.id) {
            return {
              ...p,
              jailTurns: (p.jailTurns || 0) + 1,
              lastRoll: [d1, d2],
            };
          }
          return p;
        });
        const updatedPlayer = updatedPlayers[currentTurnIdx];

        ioToSystemChat(`🎲 ${updatedPlayer.name} rolled ${d1}+${d2} in Jail.`);

        if (isDoubles) {
          updatedPlayer.inJail = false;
          updatedPlayer.jailTurns = 0;
          updatedPlayer.position = (updatedPlayer.position! + sum) % 40;
          ioToSystemChat(`🔓 Doubles! ${updatedPlayer.name} got out of jail free and advanced to ${freshBoard[updatedPlayer.position].name}.`);
          resolveLandedSpaceSingle(updatedPlayers, freshBoard, updatedPlayer, sum, freshChanceDeck, freshChestDeck);
        } else {
          if (updatedPlayer.jailTurns === 3) {
            ioToSystemChat(`👮 3 turns in jail. ${updatedPlayer.name} must pay $50 fine.`);
            if (updatedPlayer.money! >= 50) {
              updatedPlayer.money! -= 50;
              updatedPlayer.inJail = false;
              updatedPlayer.jailTurns = 0;
              updatedPlayer.position = (updatedPlayer.position! + sum) % 40;
              resolveLandedSpaceSingle(updatedPlayers, freshBoard, updatedPlayer, sum, freshChanceDeck, freshChestDeck);
            } else {
              setMonopolyActiveDebt({
                from: updatedPlayer.id,
                to: 'bank',
                amountValue: 50
              });
              setMonopolyPhase('bankrupt_decision');
              updatePlayersAndBoard(updatedPlayers, freshBoard);
            }
          } else {
            ioToSystemChat(`🔒 Failed to roll doubles. ${updatedPlayer.name} remains in jail.`);
            setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
            updatePlayersAndBoard(updatedPlayers, freshBoard);
          }
        }
        setIsMonopolyAnimating(false);
      }, 2200);
    }

    else if (action === 'pay-jail-fine') {
      if (currentPlayer.money! >= 50) {
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return {
              ...p,
              money: p.money! - 50,
              inJail: false,
              jailTurns: 0,
            };
          }
          return p;
        });
        ioToSystemChat(`🔓 ${currentPlayer.name} paid $50 fine and is released from jail.`);
        updatePlayersAndBoard(nextPlayers, currentBoard);
        setMonopolyPhase('roll');
      }
    }

    else if (action === 'use-jail-card') {
      if (currentPlayer.getOutOfJailCards! > 0) {
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return {
              ...p,
              getOutOfJailCards: p.getOutOfJailCards! - 1,
              inJail: false,
              jailTurns: 0,
            };
          }
          return p;
        });
        ioToSystemChat(`🔓 ${currentPlayer.name} used a Get Out of Jail Free card and is released.`);
        updatePlayersAndBoard(nextPlayers, currentBoard);
        setMonopolyPhase('roll');
      }
    }

    else if (action === 'buy-property') {
      if (currentPhase !== 'action') return;
      const tile = currentBoard[currentPlayer.position!];
      if (tile && tile.owner === null && tile.price && currentPlayer.money! >= tile.price) {
        const nextBoard = currentBoard.map(t => {
          if (t.index === tile.index) {
            return { ...t, owner: currentPlayer.id };
          }
          return t;
        });
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return { ...p, money: p.money! - tile.price! };
          }
          return p;
        });
        ioToSystemChat(`🏠 ${currentPlayer.name} bought ${tile.name} for $${tile.price}.`);

        const isGetRich = rules.ruleset === 'Get Rich';
        if (isGetRich && tile.type === 'property') {
          setMonopolyPhase('landed_build');
          setMonopolyLandedBuildMaxHouses(4);
          updatePlayersAndBoard(nextPlayers, nextBoard);
        } else {
          setEndTurnPhaseSingle(currentPlayer, nextPlayers);
          updatePlayersAndBoard(nextPlayers, nextBoard);
        }
      }
    }

    else if (action === 'pass-property') {
      if (currentPhase !== 'action') return;
      ioToSystemChat(`🏠 ${currentPlayer.name} passed on buying ${currentBoard[currentPlayer.position!].name}.`);
      const isGetRich = rules.ruleset === 'Get Rich';
      if (isGetRich) {
        resumeAfterAuctionSingle(currentPlayer, currentPlayers, currentBoard);
      } else {
        const bidders = currentPlayers.filter(p => !p.bankrupt).map(p => p.id);

        if (bidders.length === 0) {
          ioToSystemChat(`🎲 No other bidders available. Auction ended.`);
          resumeAfterAuctionSingle(currentPlayer, currentPlayers, currentBoard);
        } else {
          setMonopolyPhase('auction');
          setMonopolyAuctionState({
            tileIndex: currentPlayer.position!,
            highestBid: 0,
            highestBidder: null,
            bidders,
            activeBidderIndex: 0
          });
          ioToSystemChat(`🎲 Auction started for ${currentBoard[currentPlayer.position!].name}! Starting bid is $10.`);
        }
      }
    }

    else if (action === 'ok-card') {
      if (currentPhase !== 'card_drawn' || !currentCard) return;
      resolveCardActionSingle(currentPlayers, currentBoard, currentPlayer, currentCard, currentCardType || '', chanceDeck, chestDeck);
    }

    else if (action === 'build-house') {
      const tileIdx = payload;
      const tile = currentBoard[tileIdx];
      if (tile && tile.owner === currentPlayer.id && !tile.mortgaged && tile.houses < 5 && currentPlayer.money! >= tile.housePrice!) {
        const nextBoard = currentBoard.map(t => {
          if (t.index === tileIdx) {
            return { ...t, houses: t.houses + 1 };
          }
          return t;
        });
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return { ...p, money: p.money! - tile.housePrice! };
          }
          return p;
        });
        ioToSystemChat(`🛠️ ${currentPlayer.name} built a house on ${tile.name} for $${tile.housePrice}.`);
        updatePlayersAndBoard(nextPlayers, nextBoard);
      }
    }

    else if (action === 'sell-house') {
      const tileIdx = payload;
      const tile = currentBoard[tileIdx];
      if (tile && tile.owner === currentPlayer.id && tile.houses > 0) {
        const nextBoard = currentBoard.map(t => {
          if (t.index === tileIdx) {
            return { ...t, houses: t.houses - 1 };
          }
          return t;
        });
        const refund = Math.floor(tile.housePrice! / 2);
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return { ...p, money: p.money! + refund };
          }
          return p;
        });
        ioToSystemChat(`🛠️ ${currentPlayer.name} sold a house on ${tile.name} for $${refund}.`);
        updatePlayersAndBoard(nextPlayers, nextBoard);

        if (currentPhase === 'bankrupt_decision' && currentActiveDebt && currentActiveDebt.from === currentPlayer.id) {
          const freshPlayer = nextPlayers.find(p => p.id === currentPlayer.id)!;
          if (freshPlayer.money! >= currentActiveDebt.amountValue) {
            resolveDebtPaymentSingle(nextPlayers, nextBoard, currentActiveDebt);
          }
        }
      }
    }

    else if (action === 'mortgage-property') {
      const tileIdx = payload;
      const tile = currentBoard[tileIdx];
      if (tile && tile.owner === currentPlayer.id && !tile.mortgaged && tile.houses === 0) {
        const nextBoard = currentBoard.map(t => {
          if (t.index === tileIdx) {
            return { ...t, mortgaged: true };
          }
          return t;
        });
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return { ...p, money: p.money! + tile.mortgageValue! };
          }
          return p;
        });
        ioToSystemChat(`🏦 ${currentPlayer.name} mortgaged ${tile.name} for +$${tile.mortgageValue}.`);
        updatePlayersAndBoard(nextPlayers, nextBoard);

        if (currentPhase === 'bankrupt_decision' && currentActiveDebt && currentActiveDebt.from === currentPlayer.id) {
          const freshPlayer = nextPlayers.find(p => p.id === currentPlayer.id)!;
          if (freshPlayer.money! >= currentActiveDebt.amountValue) {
            resolveDebtPaymentSingle(nextPlayers, nextBoard, currentActiveDebt);
          }
        }
      }
    }

    else if (action === 'unmortgage-property') {
      const tileIdx = payload;
      const tile = currentBoard[tileIdx];
      const cost = Math.floor(tile.mortgageValue! * 1.1);
      if (tile && tile.owner === currentPlayer.id && tile.mortgaged && currentPlayer.money! >= cost) {
        const nextBoard = currentBoard.map(t => {
          if (t.index === tileIdx) {
            return { ...t, mortgaged: false };
          }
          return t;
        });
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            return { ...p, money: p.money! - cost };
          }
          return p;
        });
        ioToSystemChat(`🏦 ${currentPlayer.name} unmortgaged ${tile.name} for $${cost}.`);
        updatePlayersAndBoard(nextPlayers, nextBoard);
      }
    }

    else if (action === 'declare-bankruptcy') {
      if (currentPhase !== 'bankrupt_decision' || !currentActiveDebt) return;

      const debtor = currentPlayer;
      const recipient = currentActiveDebt.to === 'bank' ? null : currentPlayers.find(p => p.id === currentActiveDebt.to);

      ioToSystemChat(`💀 ${debtor.name} declared BANKRUPTCY and is eliminated!`);

      const nextBoard = currentBoard.map(tile => {
        if (tile.owner === debtor.id) {
          return {
            ...tile,
            owner: recipient ? recipient.id : null,
            houses: 0,
            mortgaged: false
          };
        }
        return tile;
      });

      const nextPlayers = currentPlayers.map(p => {
        if (p.id === debtor.id) {
          return { ...p, bankrupt: true, money: 0, score: 0 };
        }
        if (recipient && p.id === recipient.id) {
          return { ...p, money: p.money! + debtor.money! };
        }
        return p;
      });

      setMonopolyActiveDebt(null);
      updatePlayersAndBoard(nextPlayers, nextBoard);

      const activePlayers = nextPlayers.filter(p => !p.bankrupt);
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        setGameState('gameover');
        ioToSystemChat(`🏆 ${winner.name} is the last tycoon standing! Victory is theirs! 🏆`);

        const rankedPlayers = nextPlayers.map(p => {
          if (p.id === winner.id) {
            return { ...p, finishRank: 1, score: p.netWorth! };
          } else {
            return { ...p, finishRank: p.finishRank || 4, score: p.netWorth || 0 };
          }
        });
        setPlayers(rankedPlayers);
      } else {
        let nextTurn = currentTurnIdx;
        const n = nextPlayers.length;
        for (let i = 0; i < n; i++) {
          nextTurn = (nextTurn + 1) % n;
          if (!nextPlayers[nextTurn].bankrupt) {
            break;
          }
        }

        const updatedPlayersWithReset = nextPlayers.map((p, idx) =>
          idx === nextTurn ? { ...p, rollCount: 0, doublesRolled: false } : p
        );

        setTurnIndex(nextTurn);
        setMonopolyPhase('roll');
        updatePlayersAndBoard(updatedPlayersWithReset, nextBoard);
      }
    }

    else if (action === 'end-turn') {
      let nextTurn = currentTurnIdx;
      const n = currentPlayers.length;

      // Decrement festivalTurns for ending player's tiles
      const boardAfterFestival = currentBoard.map(tile =>
        tile.owner === currentPlayer.id && (tile as any).festivalTurns > 0
          ? { ...tile, festivalTurns: (tile as any).festivalTurns - 1 }
          : tile
      );
      setMonopolyBoard(boardAfterFestival);

      const nextTurnCount = monopolyTurnCount + 1;
      setMonopolyTurnCount(nextTurnCount);

      // Check turn limit
      const limitReached = checkTurnLimitSingle(currentPlayers, nextTurnCount);
      if (limitReached) {
        return;
      }

      if (currentPlayer.doublesRolled && !currentPlayer.inJail && !currentPlayer.bankrupt) {
        currentPlayer.doublesRolled = false;
        setPlayers(currentPlayers.map(p => p.id === currentPlayer.id ? { ...p, doublesRolled: false } : p));
        ioToSystemChat(`🎲 Doubles! ${currentPlayer.name} gets to roll again.`);
        setMonopolyPhase('roll');
      } else {
        for (let i = 0; i < n; i++) {
          nextTurn = (nextTurn + 1) % n;
          if (!currentPlayers[nextTurn].bankrupt) {
            break;
          }
        }
        setTurnIndex(nextTurn);
        setMonopolyPhase('roll');
        setPlayers(currentPlayers.map((p, idx) => idx === nextTurn ? { ...p, rollCount: 0, doublesRolled: false } : p));
      }
    }

    else if (action === 'festival-select') {
      if (currentPhase !== 'festival_selection') return;
      const tileIdx = payload as number;
      const festTile = currentBoard[tileIdx];
      if (!festTile || festTile.owner !== currentPlayer.id) return;
      const nextBoard = currentBoard.map(t =>
        t.index === tileIdx ? { ...t, festivalTurns: 3 } : t
      );
      ioToSystemChat(`🎉 ${currentPlayer.name} boosted ${festTile.name}! Rent doubled for 3 turns.`);
      setMonopolyLastActionDetail({ type: 'festival', tileIndex: tileIdx });
      setEndTurnPhaseSingle(currentPlayer, currentPlayers);
      updatePlayersAndBoard(currentPlayers, nextBoard);
    }

    else if (action === 'festival-skip') {
      if (currentPhase !== 'festival_selection') return;
      setEndTurnPhaseSingle(currentPlayer, currentPlayers);
      updatePlayersAndBoard(currentPlayers, currentBoard);
    }

    else if (action === 'airport-fly') {
      if (currentPhase !== 'airport_selection') return;
      const { targetIndex } = payload || {};
      if (targetIndex === undefined || currentPlayer.money! < 100) return;
      const oldPos = currentPlayer.position!;
      const nextPlayers = currentPlayers.map(p => {
        if (p.id === currentPlayer.id) {
          const newMoney = p.money! - 100 + (targetIndex < oldPos ? 200 : 0);
          return { ...p, money: newMoney, position: targetIndex };
        }
        return p;
      });
      const updatedAirPlayer = nextPlayers.find(p => p.id === currentPlayer.id)!;
      if (targetIndex < oldPos) ioToSystemChat(`${currentPlayer.name} passed GO while flying and collected $200!`);
      ioToSystemChat(`✈️ ${currentPlayer.name} paid $100 and flew to ${currentBoard[targetIndex].name}.`);
      const diceSum = (currentPlayer.lastRoll?.[0] || 1) + (currentPlayer.lastRoll?.[1] || 1);
      updatePlayersAndBoard(nextPlayers, currentBoard);
      resolveLandedSpaceSingle(nextPlayers, currentBoard, updatedAirPlayer, diceSum, chanceDeck, chestDeck);
    }

    else if (action === 'airport-skip') {
      if (currentPhase !== 'airport_selection') return;
      ioToSystemChat(`${currentPlayer.name} skipped the Airport.`);
      setEndTurnPhaseSingle(currentPlayer, currentPlayers);
      updatePlayersAndBoard(currentPlayers, currentBoard);
    }

    else if (action === 'force-acquire') {
      const pfa = monopolyPendingForceAcquire;
      if (currentPhase !== 'force_acquire_decision' || !pfa) return;
      if (pfa.byId !== currentPlayer.id) return;
      const faTile = currentBoard[pfa.tileIndex];
      if (!faTile) return;
      const prevOwner = currentPlayers.find(p => p.id === faTile.owner)!;
      if (currentPlayer.money! < pfa.worth) return;
      const nextPlayers = currentPlayers.map(p => {
        if (p.id === currentPlayer.id) return { ...p, money: p.money! - pfa.worth };
        if (p.id === prevOwner.id) return { ...p, money: p.money! + pfa.worth };
        return p;
      });
      const nextBoard = currentBoard.map(t =>
        t.index === pfa.tileIndex ? { ...t, owner: currentPlayer.id } : t
      );
      ioToSystemChat(`💼 ${currentPlayer.name} force-acquired ${faTile.name} from ${prevOwner.name} for $${pfa.worth}!`);
      setMonopolyLastActionDetail({ type: 'force-acquire', tileIndex: pfa.tileIndex });
      setMonopolyPendingForceAcquire(null);
      if (faTile.houses === 4) {
        setMonopolyPhase('landed_build');
        setMonopolyLandedBuildMaxHouses(5);
        updatePlayersAndBoard(nextPlayers, nextBoard);
      } else {
        setEndTurnPhaseSingle(currentPlayer, nextPlayers);
        updatePlayersAndBoard(nextPlayers, nextBoard);
      }
    }

    else if (action === 'decline-force-acquire') {
      if (!['force_acquire_decision', 'use_angel_force'].includes(currentPhase)) return;
      setMonopolyPendingForceAcquire(null);
      setEndTurnPhaseSingle(currentPlayer, currentPlayers);
      updatePlayersAndBoard(currentPlayers, currentBoard);
    }

    else if (action === 'use-angel-rent') {
      const pr = monopolyPendingRent;
      if (currentPhase !== 'use_angel_rent' || !pr) return;
      if ((currentPlayer as any).angelCards > 0) {
        const nextPlayers = currentPlayers.map(p =>
          p.id === currentPlayer.id ? { ...p, angelCards: Math.max(0, ((p as any).angelCards || 1) - 1) } : p
        );
        ioToSystemChat(`😇 ${currentPlayer.name} used an Angel Card to skip rent!`);
        setMonopolyPendingRent(null);
        setEndTurnPhaseSingle(currentPlayer, nextPlayers);
        updatePlayersAndBoard(nextPlayers, currentBoard);
      }
    }

    else if (action === 'decline-angel-rent') {
      const pr = monopolyPendingRent;
      if (currentPhase !== 'use_angel_rent' || !pr) return;
      const drDebtor = currentPlayers.find(p => p.id === pr.fromId)!;
      const drCreditor = currentPlayers.find(p => p.id === pr.toId)!;
      setMonopolyPendingRent(null);

      const moneyAfterRent = drDebtor.money! - pr.amount;
      if (moneyAfterRent >= 0) {
        const nextPlayers = currentPlayers.map(p => {
          if (p.id === drDebtor.id) return { ...p, money: moneyAfterRent };
          if (p.id === drCreditor.id) return { ...p, money: p.money! + pr.amount };
          return p;
        });
        ioToSystemChat(`${drDebtor.name} paid $${pr.amount} rent to ${drCreditor.name}.`);

        const drTile = currentBoard[drDebtor.position!];
        const tileWorth = (drTile.price || 0) + (drTile.houses || 0) * (drTile.housePrice || 0);

        if (drTile && drTile.houses < 5 && rules.ruleset === 'Get Rich' && moneyAfterRent >= tileWorth) {
          setMonopolyPendingForceAcquire({ byId: drDebtor.id, tileIndex: drTile.index, worth: tileWorth });
          if ((drCreditor as any).angelCards > 0) {
            setMonopolyPhase('use_angel_force');
          } else {
            setMonopolyPhase('force_acquire_decision');
          }
          updatePlayersAndBoard(nextPlayers, currentBoard);
        } else {
          const freshPlayer = nextPlayers.find(p => p.id === drDebtor.id)!;
          setEndTurnPhaseSingle(freshPlayer, nextPlayers);
          updatePlayersAndBoard(nextPlayers, currentBoard);
        }
      } else {
        triggerPaymentSingle(currentPlayers, currentBoard, drDebtor, drCreditor, pr.amount);
      }
    }

    else if (action === 'use-angel-force') {
      const pfa = monopolyPendingForceAcquire;
      if (currentPhase !== 'use_angel_force' || !pfa) return;
      const faTile = currentBoard[pfa.tileIndex];
      if (!faTile) return;
      const tileOwner = currentPlayers.find(p => p.id === faTile.owner);
      if (!tileOwner || (tileOwner as any).angelCards <= 0) return;
      const nextPlayers = currentPlayers.map(p =>
        p.id === tileOwner.id ? { ...p, angelCards: Math.max(0, ((p as any).angelCards || 1) - 1) } : p
      );
      ioToSystemChat(`😇 ${tileOwner.name} used an Angel Card to block the force acquisition!`);
      setMonopolyPendingForceAcquire(null);
      setEndTurnPhaseSingle(currentPlayer, nextPlayers);
      updatePlayersAndBoard(nextPlayers, currentBoard);
    }

    else if (action === 'decline-angel-force') {
      if (currentPhase !== 'use_angel_force') return;
      setMonopolyPhase('force_acquire_decision');
    }

    else if (action === 'landed-build') {
      if (currentPhase !== 'landed_build') return;
      let lbIdx: number;
      let count = 1;
      if (payload && typeof payload === 'object') {
        lbIdx = payload.tileIndex;
        count = payload.count;
      } else {
        lbIdx = payload as number;
      }
      const lbTile = currentBoard[lbIdx];
      if (!lbTile || lbTile.type !== 'property' || lbTile.owner !== currentPlayer.id || lbTile.mortgaged) return;
      const maxHouses = monopolyLandedBuildMaxHouses !== undefined ? monopolyLandedBuildMaxHouses : 4;
      if (lbTile.houses + count > maxHouses) return;

      const totalPrice = (lbTile.housePrice || 0) * count;
      if (currentPlayer.money! < totalPrice) return;

      const nextPlayers = currentPlayers.map(p =>
        p.id === currentPlayer.id ? { ...p, money: p.money! - totalPrice } : p
      );
      const nextBoard = currentBoard.map(t =>
        t.index === lbIdx ? { ...t, houses: t.houses + count } : t
      );
      const buildName = (lbTile.houses + count === 5) ? 'Hotel!' : `${lbTile.houses + count} house(s)`;
      ioToSystemChat(`🏗️ ${currentPlayer.name} instantly built on ${lbTile.name} (${buildName}).`);
      updatePlayersAndBoard(nextPlayers, nextBoard);
    }

    else if (action === 'landed-build-done') {
      if (currentPhase !== 'landed_build') return;
      setEndTurnPhaseSingle(currentPlayer, currentPlayers);
      updatePlayersAndBoard(currentPlayers, currentBoard);
    }

    else if (action === 'auction-bid') {
      const { monopolyAuctionState: auctionState } = stateRef.current;
      if (!auctionState) return;

      const bid = payload.bid;
      const bidderId = auctionState.bidders[auctionState.activeBidderIndex];
      const bidder = currentPlayers.find(p => p.id === bidderId);

      if (bidder && bid > auctionState.highestBid && bidder.money! >= bid) {
        if (auctionState.bidders.length === 1) {
          const tile = currentBoard[auctionState.tileIndex];
          if (tile) {
            const updatedPlayers = currentPlayers.map(p => {
              if (p.id === bidderId) {
                return { ...p, money: p.money! - bid };
              }
              return p;
            });
            const updatedBoard = currentBoard.map(t => {
              if (t.index === auctionState.tileIndex) {
                return { ...t, owner: bidderId };
              }
              return t;
            });

            ioToSystemChat(`🏆 ${bidder.name} won the auction and bought ${tile.name} for $${bid}!`);
            setMonopolyAuctionState(null);

            const activePlayerFresh = updatedPlayers[currentTurnIdx];
            resumeAfterAuctionSingle(activePlayerFresh, updatedPlayers, updatedBoard);
          }
        } else {
          const nextAuctionState = {
            ...auctionState,
            highestBid: bid,
            highestBidder: bidderId,
            activeBidderIndex: (auctionState.activeBidderIndex + 1) % auctionState.bidders.length
          };
          setMonopolyAuctionState(nextAuctionState);
          ioToSystemChat(`💰 ${bidder.name} bid $${bid}.`);
        }
      }
    }

    else if (action === 'auction-pass') {
      const { monopolyAuctionState: auctionState } = stateRef.current;
      if (!auctionState) return;

      const bidderId = auctionState.bidders[auctionState.activeBidderIndex];
      const bidder = currentPlayers.find(p => p.id === bidderId);

      if (bidder) {
        ioToSystemChat(`❌ ${bidder.name} passed in auction.`);
        const nextBidders = auctionState.bidders.filter((id: string) => id !== bidderId);

        if (nextBidders.length === 0) {
          ioToSystemChat(`🎲 Auction ended. No one bought ${currentBoard[auctionState.tileIndex].name}.`);
          setMonopolyAuctionState(null);
          resumeAfterAuctionSingle(currentPlayer, currentPlayers, currentBoard);
        } else {
          let nextActiveIndex = auctionState.activeBidderIndex;
          if (nextActiveIndex >= nextBidders.length) {
            nextActiveIndex = 0;
          }

          if (nextBidders.length === 1 && auctionState.highestBidder !== null) {
            const winnerId = auctionState.highestBidder;
            const winner = currentPlayers.find(p => p.id === winnerId);
            const tile = currentBoard[auctionState.tileIndex];

            if (winner && tile) {
              const updatedPlayers = currentPlayers.map(p => {
                if (p.id === winnerId) {
                  return { ...p, money: p.money! - auctionState.highestBid };
                }
                return p;
              });
              const updatedBoard = currentBoard.map(t => {
                if (t.index === auctionState.tileIndex) {
                  return { ...t, owner: winnerId };
                }
                return t;
              });

              ioToSystemChat(`🏆 ${winner.name} won the auction and bought ${tile.name} for $${auctionState.highestBid}!`);
              setMonopolyAuctionState(null);

              const activePlayerFresh = updatedPlayers[currentTurnIdx];
              resumeAfterAuctionSingle(activePlayerFresh, updatedPlayers, updatedBoard);
            }
          } else {
            setMonopolyAuctionState({
              ...auctionState,
              bidders: nextBidders,
              activeBidderIndex: nextActiveIndex
            });
          }
        }
      }
    }

    else if (action === 'trade-propose') {
      if (currentPlayer.id !== 'local_user') return;
      const {
        receiverId,
        senderProperties,
        senderMoney,
        receiverProperties,
        receiverMoney,
        senderJailCards,
        receiverJailCards
      } = payload || {};

      const sender = currentPlayers.find(p => p.id === currentPlayer.id);
      const receiver = currentPlayers.find(p => p.id === receiverId);
      if (!sender || !receiver || sender.bankrupt || receiver.bankrupt) return;

      if (senderMoney > sender.money! || receiverMoney > receiver.money!) return;
      if (senderJailCards > sender.getOutOfJailCards! || receiverJailCards > receiver.getOutOfJailCards!) return;

      setMonopolyActiveTrade({
        senderId: sender.id,
        receiverId: receiver.id,
        senderProperties,
        senderMoney,
        receiverProperties,
        receiverMoney,
        senderJailCards,
        receiverJailCards,
        status: 'pending'
      });

      ioToSystemChat(`🤝 ${sender.name} proposed a trade to ${receiver.name}.`);
    }

    else if (action === 'trade-accept') {
      const { monopolyActiveTrade: activeTrade } = stateRef.current;
      if (!activeTrade) return;

      const { senderId, receiverId, senderProperties, senderMoney, receiverProperties, receiverMoney, senderJailCards, receiverJailCards } = activeTrade;
      const sender = currentPlayers.find(p => p.id === senderId);
      const receiver = currentPlayers.find(p => p.id === receiverId);
      if (!sender || !receiver || sender.bankrupt || receiver.bankrupt) {
        setMonopolyActiveTrade(null);
        return;
      }

      if (sender.money! < senderMoney || receiver.money! < receiverMoney) {
        setMonopolyActiveTrade(null);
        ioToSystemChat(`❌ Trade failed: players do not have enough money.`);
        return;
      }
      if (sender.getOutOfJailCards! < senderJailCards || receiver.getOutOfJailCards! < receiverJailCards) {
        setMonopolyActiveTrade(null);
        ioToSystemChat(`❌ Trade failed: players do not have enough jail cards.`);
        return;
      }

      const nextBoard = currentBoard.map(tile => {
        if (senderProperties.includes(tile.index)) {
          return { ...tile, owner: receiverId };
        }
        if (receiverProperties.includes(tile.index)) {
          return { ...tile, owner: senderId };
        }
        return tile;
      });

      const nextPlayers = currentPlayers.map(p => {
        if (p.id === senderId) {
          return {
            ...p,
            money: p.money! - senderMoney + receiverMoney,
            getOutOfJailCards: p.getOutOfJailCards! - senderJailCards + receiverJailCards
          };
        }
        if (p.id === receiverId) {
          return {
            ...p,
            money: p.money! - receiverMoney + senderMoney,
            getOutOfJailCards: p.getOutOfJailCards! - receiverJailCards + senderJailCards
          };
        }
        return p;
      });

      ioToSystemChat(`🤝 Trade accepted! Assets exchanged between ${sender.name} and ${receiver.name}.`);
      setMonopolyActiveTrade(null);
      updatePlayersAndBoard(nextPlayers, nextBoard);
    }

    else if (action === 'trade-decline') {
      const { monopolyActiveTrade: activeTrade } = stateRef.current;
      if (!activeTrade) return;
      const receiver = currentPlayers.find(p => p.id === activeTrade.receiverId);
      ioToSystemChat(`❌ Trade offer declined${receiver ? ` by ${receiver.name}` : ''}.`);
      setMonopolyActiveTrade(null);
    }

    else if (action === 'trade-counter') {
      const { monopolyActiveTrade: activeTrade } = stateRef.current;
      if (!activeTrade) return;
      setMonopolyActiveTrade({
        ...activeTrade,
        status: 'countering'
      });
      const receiver = currentPlayers.find(p => p.id === activeTrade.receiverId);
      const sender = currentPlayers.find(p => p.id === activeTrade.senderId);
      ioToSystemChat(`🔄 ${receiver ? receiver.name : 'Opponent'} is preparing a counter offer to ${sender ? sender.name : 'player'}.`);
    }

    else if (action === 'trade-cancel') {
      ioToSystemChat(`Trade offer canceled.`);
      setMonopolyActiveTrade(null);
    }
  };

  const startSinglePlayerGame = () => {
    if (gameType === 'monopoly') {
      startSinglePlayerMonopolyGame();
      return;
    }
    if (gameType === 'uno') {
      startSinglePlayerUnoGame();
      return;
    }

    sfx.playDeal();

    // Auto-fill empty slots with bots up to 4 players
    const currentPlayers = [...players];
    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
    ] as AvatarConfig[];

    while (currentPlayers.length < 4) {
      const existingNames = currentPlayers.map((p) => p.name);
      const unusedNames = BOT_NAMES.filter((n) => !existingNames.includes(n));
      const botName = unusedNames.length > 0
        ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
        : `Bot ${currentPlayers.length + 1}`;
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
  // Reset bot drawn tracking on every turn change to prevent stale state
  useEffect(() => {
    botDrawnRef.current = {};
  }, [turnIndex]);

  // Play sound effect when auction is initiated
  useEffect(() => {
    if (monopolyPhase === 'auction') {
      sfx.playAuction();
    }
  }, [monopolyPhase]);

  // Multiplayer bot trigger watcher - executes deferred bot decisions when animation ends
  useEffect(() => {
    if (isSinglePlayer || gameState !== 'playing') {
      prevMultiplayerPlayersRef.current = null;
      return;
    }

    prevMultiplayerPlayersRef.current = players;

    if (isMonopolyAnimating) return;

    if (lastBotSyncRoomStateRef.current) {
      const roomState = lastBotSyncRoomStateRef.current;
      lastBotSyncRoomStateRef.current = null;
      triggerBotLogicForMultiplayer(roomState);
    }
  }, [
    isMonopolyAnimating,
    gameState,
    isSinglePlayer,
    players,
    turnIndex,
    monopolyPhase,
    monopolyBoard
  ]);

  useEffect(() => {
    if (!isSinglePlayer || gameState !== 'playing') {
      prevSingleplayerBoardRef.current = null;
      prevSingleplayerPlayersRef.current = null;
      return;
    }
    if (isMonopolyAnimating) return;

    let targetBotId: string | null = null;
    let targetBotPlayer: Player | null = null;

    if (gameType === 'monopoly') {
      prevSingleplayerBoardRef.current = monopolyBoard;
      prevSingleplayerPlayersRef.current = players;

      if ((monopolyPhase as string) === 'rolling_animation') {
        return;
      }

      if (monopolyPhase === 'auction' && monopolyAuctionState) {
        const bidderId = monopolyAuctionState.bidders[monopolyAuctionState.activeBidderIndex];
        const bidder = players.find(p => p.id === bidderId);
        if (bidder && bidder.isBot) {
          targetBotId = bidderId;
          targetBotPlayer = bidder;
        }
      } else if (monopolyPhase === 'use_angel_force' && monopolyPendingForceAcquire) {
        const faTile = monopolyBoard[monopolyPendingForceAcquire.tileIndex];
        if (faTile) {
          const owner = players.find(p => p.id === faTile.owner);
          if (owner && owner.isBot) {
            targetBotId = owner.id;
            targetBotPlayer = owner;
          }
        }
      } else if (monopolyActiveTrade && monopolyActiveTrade.status === 'pending') {
        const receiver = players.find(p => p.id === monopolyActiveTrade.receiverId);
        if (receiver && receiver.isBot) {
          targetBotId = receiver.id;
          targetBotPlayer = receiver;
        }
      } else {
        const currentPlayer = players[turnIndex];
        if (currentPlayer && currentPlayer.isBot) {
          targetBotId = currentPlayer.id;
          targetBotPlayer = currentPlayer;
        }
      }
    } else {
      const currentPlayer = players[turnIndex];
      if (currentPlayer && currentPlayer.isBot) {
        targetBotId = currentPlayer.id;
        targetBotPlayer = currentPlayer;
      }
    }

    if (targetBotId && targetBotPlayer) {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);

      const delay = (gameType === 'monopoly')
        ? (monopolyPhase === 'card_drawn' ? 3000 : 1000)
        : 1500;

      botTimerRef.current = setTimeout(() => {
        // Retrieve the absolute freshest state from the ref
        const {
          players: latestPlayers,
          turnIndex: latestTurnIndex,
          gameState: latestGameState,
          rules: latestRules,
          gameType: latestGameType,
          unoCurrentColor: currentColor,
          unoCurrentValue: currentValue,
          unoAccumulatedDrawCount: accumulatedDraw,
          unoSevenSwappingPlayerId: swappingPlayerId,
          monopolyPhase: latestPhase,
          monopolyAuctionState: latestAuctionState,
          monopolyActiveTrade: latestActiveTrade
        } = stateRef.current;

        // Validation guard: Verify game state is still playing
        if (latestGameState !== 'playing') return;

        if (latestGameType === 'uno') {
          // Special case: 7 swap target selection
          if (swappingPlayerId === targetBotId) {
            const opponents = latestPlayers.filter((p) => p.id !== targetBotId);
            opponents.sort((a, b) => a.cards.length - b.cards.length);
            const target = opponents[0];
            if (target) {
              swapHandUnoSingle(target.id);
            }
            return;
          }

          const activePlayer = latestPlayers[latestTurnIndex];
          if (!activePlayer || activePlayer.id !== targetBotId) return;

          const hand = activePlayer.cards.filter((c): c is UnoCard => c !== null);

          // Stacking / Normal Play decision
          const decision = getBotPlayDecision(
            hand,
            currentColor,
            currentValue,
            accumulatedDraw || 0,
            latestRules.stacking || false
          );

          if (decision.action === 'play') {
            playCardUnoSingle(decision.card, decision.chosenColor);

            // Bot calling Uno
            if (activePlayer.cards.length <= 2 && !activePlayer.safeUno) {
              if (Math.random() < 0.8) {
                setPlayers(prev => prev.map(pl => {
                  if (pl.id === targetBotId) {
                    return { ...pl, safeUno: true };
                  }
                  return pl;
                }));
                const unoMsg: ChatMessage = {
                  id: `sys_${Math.random()}`,
                  senderName: 'System',
                  senderId: 'system',
                  text: `📣 UNO! ${activePlayer.name} is down to their last card!`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  system: true,
                };
                setChatMessages((prevMsgs) => [...prevMsgs, unoMsg]);
              }
            }
          } else {
            // Bot needs to draw
            if (!botDrawnRef.current[targetBotId]) {
              botDrawnRef.current[targetBotId] = true;
              drawCardUnoSingle();
              setTimeout(() => {
                const { players: freshP, turnIndex: freshTurn, gameState: freshGS } = stateRef.current;
                if (freshGS !== 'playing') return;
                const freshBot = freshP[freshTurn];
                if (!freshBot || freshBot.id !== targetBotId) return;
                const freshHand = freshBot.cards.filter((c: any) => c !== null);
                const newDecision = getBotPlayDecision(
                  freshHand,
                  stateRef.current.unoCurrentColor,
                  stateRef.current.unoCurrentValue,
                  stateRef.current.unoAccumulatedDrawCount || 0,
                  stateRef.current.rules.stacking || false
                );
                if (newDecision.action === 'play') {
                  playCardUnoSingle(newDecision.card, newDecision.chosenColor);
                } else {
                  passTurnUnoSingle();
                }
                botDrawnRef.current[targetBotId] = false;
              }, 800);
            } else {
              botDrawnRef.current[targetBotId] = false;
              passTurnUnoSingle();
            }
          }
        } else if (latestGameType === 'monopoly') {
          if (latestPhase === 'auction' && latestAuctionState) {
            const bidderId = latestAuctionState.bidders[latestAuctionState.activeBidderIndex];
            if (bidderId !== targetBotId) return;

            const activeTileIndex = latestAuctionState.tileIndex;
            const landedTile = stateRef.current.monopolyBoard[activeTileIndex];
            const decision = getBotMonopolyDecision(
              targetBotPlayer,
              stateRef.current.monopolyBoard,
              'auction',
              null,
              landedTile,
              latestAuctionState
            );
            if (decision) {
              handleMonopolyActionSingle(decision.action, decision.payload);
            }
          } else if (latestActiveTrade && latestActiveTrade.status === 'pending' && latestActiveTrade.receiverId === targetBotId) {
            const otherPlayer = latestPlayers.find(pl => pl.id === latestActiveTrade.senderId);
            const accepted = evaluateBotTrade(targetBotPlayer, otherPlayer, stateRef.current.monopolyBoard, latestActiveTrade);
            handleMonopolyActionSingle(accepted ? 'trade-accept' : 'trade-decline');
          } else {
            const activeBot = latestPlayers[latestTurnIndex];
            if (!activeBot || activeBot.id !== targetBotId || activeBot.bankrupt) return;

            const activeTileIndex = activeBot.position || 0;
            const landedTile = stateRef.current.monopolyBoard[activeTileIndex];

            const decision = getBotMonopolyDecision(
              activeBot,
              stateRef.current.monopolyBoard,
              latestPhase,
              stateRef.current.monopolyActiveDebt,
              landedTile,
              null, // auctionState
              stateRef.current.monopolyLandedBuildMaxHouses,
              latestRules?.ruleset === 'Get Rich'
            );

            if (decision) {
              handleMonopolyActionSingle(decision.action, decision.payload);
            }
          }
        } else {
          // Capsa Logic
          const activePlayer = latestPlayers[latestTurnIndex];
          if (!activePlayer || activePlayer.id !== targetBotId) return;
          const hand = activePlayer.cards.filter((c): c is Card => c !== null);
          const isFirstPlay = latestPlayers.every(p => p.cards.length === 13) && !stateRef.current.activePlay;

          const play = getBotPlay(hand, stateRef.current.activePlay, isFirstPlay, {
            enableBombsSingle: latestRules.enableBombsSingle,
            enableBombsPair: latestRules.enableBombsPair,
          });

          if (play && play.length > 0) {
            playCardsSingle(activePlayer.id, play);
          } else {
            passTurnSingle(activePlayer.id);
          }
        }
      }, delay);
    }

    return () => {
      // Only clear the shared bot timer in singleplayer mode.
      // In multiplayer, triggerBotLogicForMultiplayer sets botTimerRef
      // and the cleanup here must not cancel it on React re-renders.
      if (isSinglePlayer && botTimerRef.current) {
        clearTimeout(botTimerRef.current);
      }
    };
  }, [
    turnIndex,
    gameState,
    isSinglePlayer,
    activePlay,
    unoCurrentColor,
    unoCurrentValue,
    unoSevenSwappingPlayerId,
    monopolyPhase,
    monopolyAuctionState,
    monopolyActiveTrade,
    monopolyActiveDebt,
    isMonopolyAnimating,
    players,
    monopolyBoard,
    monopolyLandedBuildMaxHouses
  ]);

  function playCardsSingle(pId: string, cards: Card[]) {
    const { players: currentPlayers, turnIndex: currentTurnIndex, activePlay: currentActivePlay } = stateRef.current;

    const idx = currentPlayers.findIndex((p) => p.id === pId);
    if (idx === -1 || idx !== currentTurnIndex) return;
    if (!cards.length) return;

    const isFirstPlay = !currentActivePlay && currentPlayers.every(p => p.cards.length === 13);
    if (isFirstPlay && !contains3Diamonds(cards)) return;

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
    const { players: currentPlayers, turnIndex: currentTurnIndex, lastPlayerPlayedId: currentLastPlayerPlayedId, activePlay: currentActivePlay } = stateRef.current;

    const idx = currentPlayers.findIndex((p) => p.id === pId);
    if (idx === -1 || idx !== currentTurnIndex) return;

    const isFirstPlay = !currentActivePlay && currentPlayers.every(p => p.cards.length === 13);
    if (isFirstPlay) return;

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

  const handleCopyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    }).catch(err => {
      console.error('Failed to copy room code: ', err);
    });
  };

  // ==================== Render Screen Switching ====================
  return (
    <div
      className={`app-container theme-${gameType}`}
      style={{
        position: 'relative',
        width: '100vw',
        maxWidth: '100vw',
        minHeight: '100vh',
        height: (screen === 'menu' || screen === 'lobby') ? '100vh' : '100dvh',
        overflowX: 'hidden',
        overflowY: (screen === 'menu' || screen === 'lobby') ? 'auto' : 'hidden',
      }}
    >
      {/* Portrait Orientation Lock Overlay */}
      {isPortrait && (
        <div className="portrait-lock-overlay">
          <div className="portrait-lock-content">
            <div className="rotate-phone-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="16" y="8" width="32" height="48" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <circle cx="32" cy="50" r="2" fill="currentColor" />
                <path d="M52 20 L56 24 L52 28" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M56 24 C56 24 50 10 32 10" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Rotate Your Device</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please switch to landscape mode to play</p>
          </div>
        </div>
      )}

      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      {(screen === 'menu' || screen === 'lobby') && <FallingBackground gameType={gameType} />}

      {screen === 'menu' && (
        <div className="menu-container">
          <div className="glass-panel menu-panel">
            <div className="menu-title-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '135px', justifyContent: 'center' }}>
              {gameType === 'uno' ? (
                <div className="uno-title-wrapper" style={{
                  display: 'inline-block',
                  position: 'relative',
                  padding: '1.25rem 3rem',
                  margin: '0 auto 0.75rem',
                }}>
                  <div className="uno-ellipse" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-6deg)',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, #ff2a2a 0%, #cc0000 100%)',
                    border: '4px solid #ffffff',
                    borderRadius: '50%',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.4)',
                    zIndex: 1
                  }} />
                  <h1 className="menu-title-uno" style={{
                    position: 'relative',
                    zIndex: 2,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '3.2rem',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    color: '#facc15',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    transform: 'skewX(-6deg)',
                    margin: 0,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    textShadow: `
                      -2px -2px 0 #000,  
                       2px -2px 0 #000,
                      -2px  2px 0 #000,  
                       2px  2px 0 #000,
                      -3px -3px 0 #000,  
                       3px -3px 0 #000,
                      -3px  3px 0 #000,  
                       3px  3px 0 #000,
                       4px  4px 0 #000,
                       0px  4px 6px rgba(0,0,0,0.6)
                    `
                  }}>
                    Sarang Judi
                  </h1>
                </div>
              ) : gameType === 'capsa' ? (
                <div className="capsa-title-wrapper" style={{
                  display: 'inline-block',
                  position: 'relative',
                  padding: '1.25rem 3rem',
                  margin: '0 auto 0.75rem',
                }}>
                  {/* Left Card Fan */}
                  <div style={{
                    position: 'absolute',
                    left: '-2.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    {/* Card 1: Ace of Spades */}
                    <div style={{
                      transform: 'rotate(-15deg) translateY(4px) translateX(8px)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1.5px solid #000000',
                      width: '42px',
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '3px 4px',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                    }}>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <span>A</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♠</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', textAlign: 'center', marginTop: '-3px' }}>♠</div>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
                        <span>A</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♠</span>
                      </div>
                    </div>

                    {/* Card 2: King of Clubs */}
                    <div style={{
                      transform: 'rotate(-5deg) translateX(-4px) translateY(-2px)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1.5px solid #000000',
                      width: '42px',
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '3px 4px',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                      marginLeft: '-15px'
                    }}>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <span>K</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♣</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', textAlign: 'center', marginTop: '-3px' }}>♣</div>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
                        <span>K</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♣</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Card Fan */}
                  <div style={{
                    position: 'absolute',
                    right: '-2.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    {/* Card 3: Queen of Hearts */}
                    <div style={{
                      transform: 'rotate(5deg) translateX(4px) translateY(-2px)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1.5px solid #ef4444',
                      width: '42px',
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '3px 4px',
                      boxSizing: 'border-box',
                      color: '#ef4444',
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                    }}>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <span>Q</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♥</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', textAlign: 'center', marginTop: '-3px' }}>♥</div>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
                        <span>Q</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♥</span>
                      </div>
                    </div>

                    {/* Card 4: 10 of Diamonds */}
                    <div style={{
                      transform: 'rotate(15deg) translateY(4px) translateX(-8px)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1.5px solid #ef4444',
                      width: '42px',
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '3px 4px',
                      boxSizing: 'border-box',
                      color: '#ef4444',
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                      marginLeft: '-15px'
                    }}>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <span>10</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♦</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', textAlign: 'center', marginTop: '-3px' }}>♦</div>
                      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
                        <span>10</span>
                        <span style={{ fontSize: '0.55rem', marginTop: '-1px' }}>♦</span>
                      </div>
                    </div>
                  </div>

                  {/* Backdrop Felt Frame */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #15803d 0%, #166534 50%, #14532d 100%)',
                    border: '3px double #fbbf24',
                    borderRadius: '16px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.6)',
                    zIndex: 2,
                    pointerEvents: 'none'
                  }} />

                  {/* Suit Symbols Floating inside Backdrop */}
                  <div style={{
                    position: 'absolute',
                    top: '5px',
                    left: '10px',
                    fontSize: '1rem',
                    opacity: 0.25,
                    color: '#fbbf24',
                    zIndex: 3,
                    pointerEvents: 'none'
                  }}>♠</div>
                  <div style={{
                    position: 'absolute',
                    bottom: '5px',
                    left: '15px',
                    fontSize: '0.8rem',
                    opacity: 0.25,
                    color: '#fbbf24',
                    zIndex: 3,
                    pointerEvents: 'none'
                  }}>♦</div>
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '15px',
                    fontSize: '0.8rem',
                    opacity: 0.25,
                    color: '#fbbf24',
                    zIndex: 3,
                    pointerEvents: 'none'
                  }}>♥</div>
                  <div style={{
                    position: 'absolute',
                    bottom: '5px',
                    right: '10px',
                    fontSize: '1rem',
                    opacity: 0.25,
                    color: '#fbbf24',
                    zIndex: 3,
                    pointerEvents: 'none'
                  }}>♣</div>

                  {/* Title Text */}
                  <h1 className="menu-title-capsa" style={{
                    position: 'relative',
                    zIndex: 4,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '3rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    margin: 0,
                    lineHeight: 1,
                    letterSpacing: '1px',
                    background: 'linear-gradient(to bottom, #ffe680 0%, #fbbf24 60%, #d97706 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 2px 5px rgba(0,0,0,0.5)',
                  }}>
                    Sarang Judi
                  </h1>
                </div>
              ) : (
                <h1 className="menu-title" style={{ transition: 'all 0.3s' }}>
                  Sarang Judi
                </h1>
              )}
              <p className="menu-subtitle">Judol Gacor Anti Rungkad by Johan</p>
            </div>

            {/* Highly Prominent & Scalable Game Mode Cards Selector */}
            <div className="mode-selector-dashboard">
              <div
                className={`mode-card ${gameType === 'capsa' ? 'active active-capsa' : ''}`}
                onClick={() => {
                  setGameType('capsa');
                  setRules(prev => ({ ...prev, pointsToWin: 15 }));
                }}
              >
                <div className="mode-card-icon">♠️</div>
                <div className="mode-card-title">Capsa Banting</div>
                <div className="mode-card-desc">Indonesian 13-card game. High-stakes card strategy.</div>
              </div>

              <div
                className={`mode-card ${gameType === 'uno' ? 'active active-uno' : ''}`}
                onClick={() => {
                  setGameType('uno');
                  setRules(prev => ({ ...prev, pointsToWin: 250 }));
                }}
              >
                <div className="mode-card-icon">🌈</div>
                <div className="mode-card-title">Uno Classic</div>
                <div className="mode-card-desc">Wild cards, house rules, stacks, and intense fast-play.</div>
              </div>

              <div
                className={`mode-card ${gameType === 'monopoly' ? 'active active-monopoly' : ''}`}
                onClick={() => {
                  setGameType('monopoly');
                  setRules(prev => ({ ...prev, pointsToWin: 0, ruleset: 'Default', startingCash: 1500, turnLimit: 0 }));
                }}
              >
                <div className="mode-card-icon">🎩</div>
                <div className="mode-card-title">Monopoly Tycoon</div>
                <div className="mode-card-desc">Interactive 3D board, rolling dice, deals, and bankrupting bots.</div>
              </div>
            </div>

            <div className="menu-content-columns">
              <div className="menu-column-left">
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
              </div>

              <div className="menu-column-right">
                {errorMsg && (
                  <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid var(--accent-red)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', color: '#fda4af', textAlign: 'center', width: '100%', marginBottom: '0.5rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="name-input-group">
                  <label>Multiplayer & Bots</label>
                  <div className="menu-actions" style={{ marginTop: '0rem' }}>
                    <button className="btn-gold" onClick={startSinglePlayerLobby}>
                      🤖 Play vs Bots
                    </button>
                    <button className="btn-primary" onClick={createOnlineRoom}>
                      🌐 Create Room
                    </button>
                  </div>
                </div>

                <div className="or-divider">Or join a friend's room</div>

                <div className="room-join-panel">
                  <input
                    type="text"
                    placeholder="Enter 4-Letter Room Code"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.slice(0, 4))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        joinOnlineRoom();
                      }
                    }}
                    maxLength={4}
                  />
                  <button className="btn-primary" onClick={joinOnlineRoom}>
                    Join Game
                  </button>
                </div>

                {/* Server Settings (Custom address deployment) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn-utility"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 0, cursor: 'pointer', textAlign: 'left', width: 'fit-content' }}
                    onClick={() => setCustomServerVisible(!customServerVisible)}
                  >
                    ⚙️ {customServerVisible ? 'Hide Server Settings' : 'Custom Server Settings'}
                  </button>
                  {customServerVisible && (
                    <input
                      type="text"
                      className="server-settings-input"
                      placeholder="Server URL (e.g. http://localhost:3001)"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <div className="lobby-container">
          <div className="lobby-header">
            <div>
              <h2 style={{
                fontSize: '2rem',
                background: gameType === 'monopoly'
                  ? 'linear-gradient(to right, #10b981, #059669)'
                  : gameType === 'uno'
                    ? 'linear-gradient(to right, #60a5fa, #4ade80)'
                    : 'linear-gradient(to right, #a78bfa, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                {gameType === 'monopoly' ? 'Monopoly' : gameType === 'uno' ? 'UNO' : 'Capsa Banting'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                {gameType === 'monopoly' ? 'board tycoon' : gameType === 'uno' ? 'house rules' : 'gacor kang'}
              </p>
            </div>

            <div className="lobby-code-display">
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>ROOM CODE:</span>
              <div className="lobby-code-badge">{roomCode}</div>
              <button
                type="button"
                className={`btn-copy-code ${copiedCode ? 'copied' : ''}`}
                onClick={handleCopyRoomCode}
                title="Copy Room Code"
              >
                {copiedCode ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* Left panel: Seats & Players */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Players ({players.length}/{gameType === 'uno' ? 8 : 4})
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
              {Array.from({ length: (gameType === 'uno' ? 8 : 4) - players.length }).map((_, i) => (
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

          <div className="glass-panel settings-panel">
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Table Rules & Settings
            </h3>

            {/* Points to Win / Ruleset */}
            <div className="settings-row">
              <label>{gameType === 'monopoly' ? 'Ruleset' : 'Target Points to Win'}</label>
              {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                gameType === 'monopoly' ? (
                  <select
                    value={rules.ruleset || 'Default'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = { ...rules, ruleset: val };
                      setRules(updated);
                      if (!isSinglePlayer) updateRulesOnline(updated);
                    }}
                  >
                    <option value="Default">Default</option>
                    <option value="Get Rich">Get Rich</option>
                  </select>
                ) : (
                  <select
                    value={rules.pointsToWin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const updated = { ...rules, pointsToWin: val };
                      setRules(updated);
                      if (!isSinglePlayer) updateRulesOnline(updated);
                    }}
                  >
                    {gameType === 'uno' ? (
                      <>
                        <option value={100}>100 Points</option>
                        <option value={250}>250 Points</option>
                        <option value={500}>500 Points</option>
                      </>
                    ) : (
                      <>
                        <option value={10}>10 Points</option>
                        <option value={15}>15 Points</option>
                        <option value={20}>20 Points</option>
                        <option value={30}>30 Points</option>
                      </>
                    )}
                  </select>
                )
              ) : (
                <span style={{ fontWeight: 'bold' }}>
                  {gameType === 'monopoly' ? (rules.ruleset || 'Default') : `${rules.pointsToWin} pts`}
                </span>
              )}
            </div>

            {gameType === 'monopoly' && (
              <>
                {/* Starting Cash */}
                <div className="settings-row">
                  <label>Starting Cash</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <select
                      value={rules.startingCash !== undefined ? rules.startingCash : 1500}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = { ...rules, startingCash: val };
                        setRules(updated);
                        if (!isSinglePlayer) updateRulesOnline(updated);
                      }}
                    >
                      <option value={1500}>$1500</option>
                      <option value={2000}>$2000</option>
                      <option value={2500}>$2500</option>
                      <option value={3000}>$3000</option>
                    </select>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>
                      ${rules.startingCash !== undefined ? rules.startingCash : 1500}
                    </span>
                  )}
                </div>

                {/* Turn Limit */}
                <div className="settings-row">
                  <label>Turn Limit</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <select
                      value={rules.turnLimit !== undefined ? rules.turnLimit : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = { ...rules, turnLimit: val };
                        setRules(updated);
                        if (!isSinglePlayer) updateRulesOnline(updated);
                      }}
                    >
                      <option value={0}>Unlimited</option>
                      <option value={15}>15 Turns</option>
                      <option value={20}>20 Turns</option>
                      <option value={25}>25 Turns</option>
                      <option value={30}>30 Turns</option>
                    </select>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>
                      {rules.turnLimit === undefined || rules.turnLimit === 0 ? 'Unlimited' : `${rules.turnLimit} Turns`}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Turn Timer Duration */}
            {gameType !== 'monopoly' && (
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
            )}

            {/* Game-specific rules settings */}
            {gameType === 'capsa' && (
              <>
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
              </>
            )}

            {gameType === 'uno' && (
              <>
                {/* Uno Stacking Toggle */}
                <div className="settings-row">
                  <label>+2 and +4 Stacking</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.stacking}
                        onChange={(e) => {
                          const updated = { ...rules, stacking: e.target.checked };
                          setRules(updated);
                          if (!isSinglePlayer) updateRulesOnline(updated);
                        }}
                      />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{rules.stacking ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>

                {/* Uno Jump-In Toggle */}
                <div className="settings-row">
                  <label>Jump-In Rules</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.jumpIn}
                        onChange={(e) => {
                          const updated = { ...rules, jumpIn: e.target.checked };
                          setRules(updated);
                          if (!isSinglePlayer) updateRulesOnline(updated);
                        }}
                      />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{rules.jumpIn ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>

                {/* Uno 7-Swap Toggle */}
                <div className="settings-row">
                  <label>7-Swap Rules</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.sevenSwap}
                        onChange={(e) => {
                          const updated = { ...rules, sevenSwap: e.target.checked };
                          setRules(updated);
                          if (!isSinglePlayer) updateRulesOnline(updated);
                        }}
                      />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{rules.sevenSwap ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>

                {/* Uno 0-Rotate Toggle */}
                <div className="settings-row">
                  <label>0-Rotate Rules</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.zeroRotate}
                        onChange={(e) => {
                          const updated = { ...rules, zeroRotate: e.target.checked };
                          setRules(updated);
                          if (!isSinglePlayer) updateRulesOnline(updated);
                        }}
                      />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{rules.zeroRotate ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>

                {/* Uno Draw Till Play Toggle */}
                <div className="settings-row">
                  <label>Draw Till Play Rules</label>
                  {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.drawTillPlay}
                        onChange={(e) => {
                          const updated = { ...rules, drawTillPlay: e.target.checked };
                          setRules(updated);
                          if (!isSinglePlayer) updateRulesOnline(updated);
                        }}
                      />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{rules.drawTillPlay ? 'Enabled' : 'Disabled'}</span>
                  )}
                </div>
              </>
            )}

            {gameType === 'monopoly' && (
              <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Classic Monopoly rules apply. Roll dice, advance around the board, buy properties, build monopolies, and drive your opponents bankrupt!
              </div>
            )}

            {/* Seat fill with bot buttons (only for host) */}
            {players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost && players.length < (gameType === 'uno' ? 8 : 4) && (
              <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column' }}>
                <button
                  className="btn-primary btn-add-bot"
                  style={{ background: 'linear-gradient(135deg, #1d72b8 0%, #1e40af 100%)', boxShadow: 'none' }}
                  onClick={() => {
                    if (isSinglePlayer) {
                      const existing = players.map((p) => p.name);
                      const unusedNames = BOT_NAMES.filter((n) => !existing.includes(n));
                      const botName = unusedNames.length > 0
                        ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
                        : `Bot ${players.length + 1}`;

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

      {screen === 'table' && gameType === 'capsa' && (
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
          isMobile={isMobileLandscape}
        />
      )}

      {screen === 'table' && gameType === 'uno' && (
        <UnoTable
          playerId={isSinglePlayer ? 'local_user' : socketId}
          players={players}
          turnIndex={turnIndex}
          currentColor={unoCurrentColor}
          currentValue={unoCurrentValue}
          playDirection={unoPlayDirection}
          accumulatedDrawCount={unoAccumulatedDrawCount}
          sevenSwappingPlayerId={unoSevenSwappingPlayerId}
          lastSevenSwap={unoLastSevenSwap}
          lastUnoChallenge={lastUnoChallenge}
          lastPlayerPlayedId={lastPlayerPlayedId}
          onClearUnoChallenge={() => setLastUnoChallenge(null)}
          discardPile={unoDiscardPile}
          gameState={gameState}
          rules={{
            pointsToWin: rules.pointsToWin,
            turnDuration: rules.turnDuration,
            stacking: !!rules.stacking,
            jumpIn: !!rules.jumpIn,
            sevenSwap: !!rules.sevenSwap,
            zeroRotate: !!rules.zeroRotate,
            drawTillPlay: !!rules.drawTillPlay,
          }}
          roomCode={roomCode}
          isHost={players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost || false}
          isSinglePlayer={isSinglePlayer}
          onPlayCard={isSinglePlayer ? (card, chosenColor, isJumpIn) => playCardUnoSingle(card, chosenColor, isJumpIn) : (card, chosenColor, isJumpIn) => socketRef.current?.emit('play-card', { roomCode, cards: [card], chosenColor, isJumpIn })}
          onDrawCard={isSinglePlayer ? drawCardUnoSingle : () => socketRef.current?.emit('draw-card', { roomCode })}
          onPass={isSinglePlayer ? passTurnUnoSingle : () => socketRef.current?.emit('pass-turn', { roomCode })}
          onUnoCall={isSinglePlayer ? unoCallUnoSingle : () => socketRef.current?.emit('uno-call', { roomCode })}
          onUnoChallenge={isSinglePlayer ? (targetId) => unoChallengeUnoSingle(targetId, 'local_user') : (targetId) => socketRef.current?.emit('uno-challenge', { roomCode, targetPlayerId: targetId })}
          onSwapHand={isSinglePlayer ? (targetId) => swapHandUnoSingle(targetId) : (targetId) => socketRef.current?.emit('swap-hand', { roomCode, targetPlayerId: targetId })}
          onRestartGame={isSinglePlayer ? restartSinglePlayerUnoGameRound : restartOnlineGame}
          onLeaveRoom={leaveRoom}
        />
      )}

      {screen === 'table' && gameType === 'monopoly' && (
        <MonopolyTable
          playerId={isSinglePlayer ? 'local_user' : socketId}
          players={players as any}
          turnIndex={turnIndex}
          monopolyBoard={monopolyBoard}
          dice={monopolyDice}
          rollId={monopolyRollId}
          monopolyPhase={monopolyPhase}
          currentCard={monopolyCurrentCard}
          cardType={monopolyCardType}
          activeDebt={monopolyActiveDebt}
          auctionState={monopolyAuctionState}
          activeTrade={monopolyActiveTrade}
          gameState={gameState}
          roomCode={roomCode}
          isHost={players.find(pl => isSinglePlayer ? pl.id === 'local_user' : pl.id === socketId)?.isHost || false}
          isSinglePlayer={isSinglePlayer}
          rules={rules}
          monopolyTurnCount={monopolyTurnCount}
          lastActionDetail={monopolyLastActionDetail}
          pendingForceAcquire={monopolyPendingForceAcquire}
          pendingRent={monopolyPendingRent}
          landedBuildMaxHouses={monopolyLandedBuildMaxHouses}
          onMonopolyAction={isSinglePlayer ? handleMonopolyActionSingle : handleMonopolyActionMultiplayer}
          onLeaveRoom={leaveRoom}
          onRestartGame={isSinglePlayer ? restartSinglePlayerMonopolyGameRound : restartOnlineGame}
          onAnimationStateChange={setIsMonopolyAnimating}
          onVisualPositionsChange={(pos) => { visualPositionsRef.current = pos; }}
          onToggleChat={() => setIsChatOpen(prev => !prev)}
        />
      )}

      {screen !== 'menu' && (
        <>
          {/* Floating Chat Button */}
          <button
            className={`floating-chat-btn ${isChatOpen || gameType === 'monopoly' ? 'hidden' : ''}`}
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

      {/* Mobile Fullscreen Toggle */}
      {(isMobileLandscape || isPortrait) && (
        <button
          className="mobile-fullscreen-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? '⊡' : '⛶'}
        </button>
      )}

      {/* Celebratory Game-End Confetti */}
      <Confetti active={showConfetti} />
    </div>
  );
}
