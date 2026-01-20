"use client"
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WS_URL, logout, createRoom } from '@/lib/auth';

interface Player {
  username: string;
  symbol: string;
}

interface GameState {
  board: (string | null)[][];
  current_turn: string;
  status: string;
}

interface GameProps {
  token: string;
  userId: string;
  username: string;
  email: string;
}

export default function Game({ token, userId, username, email }: GameProps) {
  const router = useRouter();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [mySymbol, setMySymbol] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState('X');
  const [gameStatus, setGameStatus] = useState('waiting');
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState('');
  const [opponent, setOpponent] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [result, setResult] = useState<{ winner?: string; isDraw?: boolean } | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isWaitingInQueue, setIsWaitingInQueue] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const updateBoard = useCallback((serverBoard: (string | null)[][]) => {
    const flatBoard: (string | null)[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        flatBoard.push(serverBoard[row][col]);
      }
    }
    setBoard(flatBoard);
  }, []);

  const handleServerEvent = useCallback((event: {
    type: string;
    room_id?: string;
    your_symbol?: string;
    game_state?: GameState;
    players?: Player[];
    username?: string;
    symbol?: string;
    winner?: string;
    message?: string;
    user_id?: string;
  }) => {
    setError('');

    switch (event.type) {
      case 'room_joined':
        console.log('room_joined event:', event);
        
        // Clear waiting queue state when successfully joined a room
        setIsWaitingInQueue(false);
        // Set room ID from the server response (important for random matches)
        if (event.room_id) {
          setRoomId(event.room_id);
        }
        setGameStatus(event.game_state?.status || 'waiting');
        setInRoom(true);
        if (event.game_state?.board) {
          updateBoard(event.game_state.board);
        }
        setCurrentTurn(event.game_state?.current_turn || 'X');
        
        // Update players list first
        if (event.players) {
          setPlayers(event.players);
          
          // Find our symbol from the players list (this is the authoritative source)
          const myPlayerData = event.players.find(p => p.username === username);
          if (myPlayerData) {
            setMySymbol(myPlayerData.symbol);
            console.log('Updated mySymbol from players list:', myPlayerData.symbol);
          } else if (event.your_symbol) {
            // Fallback to event.your_symbol if not found in players
            setMySymbol(event.your_symbol);
            console.log('Updated mySymbol from your_symbol:', event.your_symbol);
          }
          
          // Find opponent
          const opponent = event.players.find(p => p.username !== username);
          setOpponent(opponent?.username || null);
        } else if (event.your_symbol) {
          // If no players list provided, use your_symbol and create minimal players list
          setMySymbol(event.your_symbol);
          setPlayers([{ username: username, symbol: event.your_symbol }]);
        }
        
        console.log('After room_joined - State:', {
          mySymbol: event.players?.find(p => p.username === username)?.symbol || event.your_symbol,
          gameStatus: event.game_state?.status,
          currentTurn: event.game_state?.current_turn,
          players: event.players,
          board: event.game_state?.board
        });
        break;

      case 'player_joined':
        if (event.username !== username) {
          setOpponent(event.username || null);
          // Add the new player to the players list
          if (event.username && event.symbol) {
            setPlayers(prevPlayers => {
              // Check if player already exists
              const playerExists = prevPlayers.some(p => p.username === event.username);
              if (!playerExists) {
                return [...prevPlayers, { username: event.username!, symbol: event.symbol! }];
              }
              return prevPlayers;
            });
          }
        }
        break;

      case 'game_started':
        setGameStatus('InProgress');
        setCurrentTurn(event.game_state?.current_turn || 'X');
        break;

      case 'move_made':
        if (event.game_state?.board) {
          updateBoard(event.game_state.board);
        }
        setCurrentTurn(event.game_state?.current_turn || 'X');
        setGameStatus(event.game_state?.status || 'waiting');
        break;

      case 'game_over':
        setGameStatus('Completed');
        if (event.game_state?.board) {
          updateBoard(event.game_state.board);
        }
        if (event.winner) {
          setResult({ winner: event.winner });
        } else {
          setResult({ isDraw: true });
        }
        break;

      case 'player_left':
        // Remove the player from the players list
        if (event.username) {
          setPlayers(prevPlayers => prevPlayers.filter(p => p.username !== event.username));
          
          // If the player who left was the opponent, clear opponent
          if (event.username === opponent) {
            setOpponent(null);
          }
        } else {
          // Fallback: clear all if no specific username
          setOpponent(null);
          setPlayers([]);
        }
        
        setGameStatus('waiting');
        setBoard(Array(9).fill(null));
        setResult(null);
        break;

      case 'waiting_in_queue':
        console.log('waiting_in_queue event:', event);
        setIsWaitingInQueue(true);
        setError('');
        break;

      case 'match_found':
        console.log('match_found event:', event);
        setIsWaitingInQueue(false);
        setToastMessage(`Match found! Playing against ${event.username}`);
        setShowToast(true);
        // Hide toast after 3 seconds
        setTimeout(() => setShowToast(false), 3000);
        break;

      case 'error':
        setError(event.message || 'Unknown error');
        setIsWaitingInQueue(false);
        break;
    }
  }, [username, updateBoard]);

  const connect = useCallback(() => {
    const socket = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected successfully');
      setConnected(true);
      setWs(socket);
      setError(''); // Clear any previous connection errors
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch (error) {
        console.error('Failed to parse message:', error, 'Raw data:', event.data);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error - check server and authentication');
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnected(false);
      setWs(null);
      setInRoom(false);
      
      // Show different messages based on close code
      if (event.code === 1006) {
        setError('Connection lost - server may be down');
      } else if (event.code === 1008) {
        setError('Connection rejected - authentication failed');
      } else if (event.code !== 1000) {
        setError(`Connection closed unexpectedly (${event.code})`);
      }
    };
  }, [token, handleServerEvent]);

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleLogout = () => {
    disconnect();
    logout();
    router.replace('/signin');
  };

  const joinRoom = () => {
    if (!ws || !connected || !roomId) {
      setError('Enter a room ID');
      return;
    }

    const message = {
      type: 'join_room',
      room_id: roomId,
      user_id: userId,
      username: username
    };

    ws.send(JSON.stringify(message));
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setError('Enter a room name');
      return;
    }

    setCreatingRoom(true);
    setError('');

    try {
      const roomData = await createRoom(newRoomName.trim());
      
      if (roomData) {
        setRoomId(roomData.room_id);
        setRoomName(newRoomName.trim());
        setNewRoomName('');
        setShowCreateRoom(false);
        
        // Auto-join the created room
        if (ws && connected) {
          const message = {
            type: 'join_room',
            room_id: roomData.room_id,
            user_id: userId,
            username: username
          };
          ws.send(JSON.stringify(message));
        }
      } else {
        setError('Failed to create room');
      }
    } catch (error) {
      setError('Failed to create room');
    } finally {
      setCreatingRoom(false);
    }
  };

  const findMatch = () => {
    if (!ws || !connected) {
      setError('Not connected to server');
      return;
    }

    const message = {
      type: 'find_match',
      user_id: userId,
      username: username
    };

    console.log('Sending find_match:', message);
    ws.send(JSON.stringify(message));
  };

  const leaveRoom = () => {
    if (!ws || !connected) return;

    const message = {
      type: 'leave_room',
      room_id: roomId
    };

    ws.send(JSON.stringify(message));
    setInRoom(false);
    setMySymbol(null);
    setGameStatus('waiting');
    setBoard(Array(9).fill(null));
    setOpponent(null);
    setPlayers([]);
    setResult(null);
    setRoomName('');
  };

  const makeMove = (index: number) => {
    // Debug logging
    console.log('makeMove called:', {
      index,
      ws: !!ws,
      connected,
      gameStatus,
      mySymbol,
      currentTurn,
      isMyTurn: mySymbol === currentTurn,
      cellOccupied: !!board[index],
      inRoom
    });

    if (!ws || !connected) {
      setError('Not connected to server');
      return;
    }
    if (gameStatus !== 'InProgress') {
      setError(`Game not in progress (status: ${gameStatus})`);
      return;
    }
    if (mySymbol !== currentTurn) {
      setError(`Not your turn (you: ${mySymbol}, current: ${currentTurn})`);
      return;
    }
    if (board[index]) {
      setError('Cell already occupied');
      return;
    }

    const row = Math.floor(index / 3);
    const col = index % 3;

    const message = {
      type: 'make_move',
      room_id: roomId,
      row,
      col
    };

    console.log('Sending move:', message);
    ws.send(JSON.stringify(message));
  };

  const playAgain = () => {
    setBoard(Array(9).fill(null));
    setGameStatus('waiting');
    setResult(null);
    setCurrentTurn('X');
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // Calculate if it's my turn consistently
  // Use the same logic as the turn display
  const currentPlayer = players.find(p => p.symbol === currentTurn);
  const isMyTurn = currentPlayer?.username === username;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
<button onClick={() => router.push('/')} className='cursor-pointer'>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-black flex items-center justify-center">
              <span className="text-sm font-bold">×</span>
            </div>
            <span className="font-medium">TIC TAC TOE</span>
          </div>
          </button>
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-black' : 'bg-neutral-300'}`} />
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-black transition-colors"
              >
                <span>{username}</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border shadow-lg z-50">
                  <div className="p-4 border-b border-border">
                    <div className="text-sm font-medium text-black">{username}</div>
                    <div className="text-xs text-muted-foreground mt-1">{email}</div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-black hover:bg-neutral-50 transition-colors rounded"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          {!inRoom && !isWaitingInQueue ? (
            // Room Join Screen
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Join or Create a Room</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Enter a room ID to join, create a new room, or find a random match
              </p>

              <div className="space-y-4">
                {!showCreateRoom ? (
                  <>
                    <input
                      type="text"
                      placeholder="Room ID"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full px-4 py-3 border border-border bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-black transition-all"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={joinRoom}
                        disabled={!connected || !roomId}
                        className="flex-1 py-3 bg-black text-white text-sm font-medium hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {connected ? 'Join Room' : 'Connecting...'}
                      </button>
                      <button
                        onClick={() => setShowCreateRoom(true)}
                        disabled={!connected}
                        className="flex-1 py-3 border-2 border-black text-black text-sm font-medium hover:bg-neutral-100 disabled:border-neutral-300 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
                      >
                        Create Room
                      </button>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        onClick={findMatch}
                        disabled={!connected}
                        className="w-full py-3 bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {connected ? 'Find Random Match' : 'Connecting...'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Room Name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full px-4 py-3 border border-border bg-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-black transition-all"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateRoom}
                        disabled={!connected || !newRoomName.trim() || creatingRoom}
                        className="flex-1 py-3 bg-black text-white text-sm font-medium hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {creatingRoom ? 'Creating...' : 'Create & Join'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateRoom(false);
                          setNewRoomName('');
                          setError('');
                        }}
                        className="flex-1 py-3 border-2 border-black text-black text-sm font-medium hover:bg-neutral-100 transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}

                {error && (
                  <div className="text-sm text-black bg-muted border border-border p-3 animate-scale-in">
                    {error}
                  </div>
                )}
              </div>
            </div>
          ) : isWaitingInQueue ? (
            // Waiting in Queue Screen
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Finding Match</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Looking for an opponent...
              </p>
              
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-medium text-black">
                  Waiting in queue
                </div>
              </div>
              
              <button
                onClick={() => {
                  setIsWaitingInQueue(false);
                  setError('');
                }}
                className="w-full py-3 border-2 border-black text-black text-sm font-medium hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              
              {error && (
                <div className="mt-4 text-sm text-black bg-muted border border-border p-3 animate-scale-in">
                  {error}
                </div>
              )}
            </div>
          ) : (
            // Game Screen
            <div>
              {/* Game Info */}
              <div className="text-center mb-8">
                <div className="text-sm text-muted-foreground mb-1">
                  {roomName ? (
                    <>
                      <div className="font-medium text-black">{roomName}</div>
                      <div className="text-xs">Room ID: {roomId}</div>
                    </>
                  ) : (
                    <>Room: {roomId}</>
                  )}
                </div>
                
                {/* Players List */}
                {players.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-muted-foreground mb-2">Players in room:</div>
                    <div className="flex justify-center gap-4">
                      {players.map((player, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className={`w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-bold ${
                            currentTurn === player.symbol ? 'bg-black text-white' : 'bg-white'
                          }`}>
                            {player.symbol === 'X' ? '×' : '○'}
                          </span>
                          <span className={`${player.username === username ? 'font-bold' : ''}`}>
                            {player.username === username ? 'You' : player.username}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Game Status Display */}
                {gameStatus === 'waiting' && (
                  <div className="flex flex-col items-center gap-3 mb-4">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-sm font-medium text-black">
                      Waiting for the other person to join
                    </div>
                  </div>
                )}
                
                {gameStatus === 'InProgress' && players.length === 2 && (
                  <div className="mt-2 text-lg font-medium">
                    {(() => {
                      const currentPlayer = players.find(p => p.symbol === currentTurn);
                      return isMyTurn ? 'Your turn' : `${currentPlayer?.username}'s turn`;
                    })()}
                  </div>
                )}

                {gameStatus === 'Completed' && !result && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Game completed
                  </div>
                )}

                {result && (
                  <div className="mt-2 text-lg font-bold animate-scale-in">
                    {result.isDraw ? 'Draw!' : result.winner === username ? 'You won!' : `${result.winner} won!`}
                  </div>
                )}
              </div>

              {/* Board */}
              <div className="grid grid-cols-3 gap-2 mb-8">
                {board.map((cell, index) => (
                  <button
                    key={index}
                    onClick={() => makeMove(index)}
                    disabled={!inRoom || gameStatus !== 'InProgress' || cell !== null || !isMyTurn}
                    className={`
                      aspect-square border-2 border-black flex items-center justify-center text-4xl font-bold
                      transition-all duration-150
                      ${!cell && isMyTurn && gameStatus === 'InProgress' 
                        ? 'hover:bg-neutral-100 cursor-pointer' 
                        : 'cursor-default'}
                      ${cell ? 'bg-white' : 'bg-white'}
                    `}
                  >
                    {cell === 'X' && <span className="animate-scale-in">×</span>}
                    {cell === 'O' && <span className="animate-scale-in">○</span>}
                  </button>
                ))}
              </div>

              {/* Your Symbol */}
              <div className="text-center text-sm text-muted-foreground mb-6">
                {(() => {
                  // Use server data as authoritative source for display
                  const myPlayerData = players.find(p => p.username === username);
                  const displaySymbol = myPlayerData?.symbol || mySymbol;
                  return (
                    <>
                      You are <span className="font-bold text-black">{displaySymbol === 'X' ? '×' : '○'}</span>
                      {myPlayerData?.symbol !== mySymbol && (
                        <span className="text-red-500 text-xs ml-2">(sync issue detected)</span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Debug Info - Remove this after fixing */}
              <div className="text-center text-xs text-muted-foreground mb-4 p-2 bg-neutral-50 border">
                <div>Debug: mySymbol={mySymbol}, currentTurn={currentTurn}, gameStatus={gameStatus}</div>
                <div>isMyTurn={isMyTurn ? 'true' : 'false'}, inRoom={inRoom ? 'true' : 'false'}, connected={connected ? 'true' : 'false'}</div>
                <div>Server says my symbol: {players.find(p => p.username === username)?.symbol || 'unknown'}</div>
                <div>Players: {JSON.stringify(players)}</div>
                <div>Current player: {JSON.stringify(players.find(p => p.symbol === currentTurn))}</div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {result && (
                  <button
                    onClick={playAgain}
                    className="flex-1 py-3 bg-black text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
                  >
                    Play Again
                  </button>
                )}
                <button
                  onClick={leaveRoom}
                  className={`${result ? 'flex-1' : 'w-full'} py-3 border-2 border-black text-black text-sm font-medium hover:bg-neutral-100 transition-colors`}
                >
                  Leave Room
                </button>
              </div>

              {error && (
                <div className="mt-4 text-sm text-black bg-muted border border-border p-3 animate-scale-in text-center">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-black text-white px-6 py-3 shadow-lg animate-fade-in z-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-2xl mx-auto text-center text-sm text-muted-foreground">
          Made by Saksham 
        </div>
      </footer>
    </div>
  );
}
