// TODOs:
// AI behaviour
// Add assists to player
// Add capture progress bar

//#region Game configuration
const WINNING_SCORE = 100;
const CAPTURE_POINT_DURATION = 15;
const MaxCaptureMultiplier = 5;
const MAX_PLAYER_COUNT = 48;
const RoundDurationMinutes = 10;
const MinimumDistanceToRevive = 2; //meters.
const MinimumDistanceToDetectEnemies = 75; //meters.
const MinimumDistanceToEnterVehicle = 100; // meters.
const BLACKCOLOR: number[] = [1, 1, 1];
const WHITECOLOR: number[] = [1, 1, 1];
const GREYCOLOR: number[] = [0.5, 0.5, 0.5];
const BLUETEAMCOLOR: number[] = [0.56, 0.89, 1];
const BLUETEAMCOLORDARK: number[] = [0.31, 0.5, 0.56];
const REDTEAMCOLOR: number[] = [0.87, 0.54, 0.45];
const REDTEAMCOLORDARK: number[] = [0.55, 0.3, 0.3];
const FILLCOLORSALPHA = 0.35;
const AIBackfill = true;
const AIDifficultyPercentage = 0.33;
const HIDDEN_OBJECT_OFFSET = 70;
const SPAWN_OBJECT_OFFSET = 80;
const TEAM_HQ1 = mod.GetTeam(1); // HQ1
const TEAM_HQ2 = mod.GetTeam(2); // HQ2
const CAPTURE_POINTS_LABELS = "ABCDEFGHIJ";

const DEBUG = true;
const DEBUG_10000 = false;
const DEBUG_20000 = false;
const DEBUG_30000 = false;
const DEBUG_40000 = false;
const DEBUG_50000 = false;
const DEBUG_60000 = false;
const DEBUG_70000 = false;
const DEBUG_80000 = false;
const DEBUG_90000 = true;

// Team assignment tracking
let team1ScoreTimer = 0;
let team2ScoreTimer = 0;
let team_hq1_tickets = WINNING_SCORE;
let team_hq2_tickets = WINNING_SCORE;
let team_hq1_size = 0;
let team_hq2_size = 0;
let adjust_hq1_difficulty_once = false;
let adjust_hq2_difficulty_once = false;

// ---------------------- Config ----------------------
let CAPTURE_POINTS: mod.CapturePoint[];
//const Capture_Points_Ids = [100, 200, 300, 400, 500];
let Capture_Points_Ids: number[];
//let AI_SPAWNERS: mod.Spawner[];
let RoundDurationSeconds = 60 * RoundDurationMinutes;
let gameEnded = false;
//#endregion

//#region Classes [DONE]
class PlayerClass
{
  id:number;
  name:string;
  player: mod.Player;
  team: mod.Team;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  flags: number;
  lastWaypointIndex:number;
  waypoint:mod.Vector;
  isInsideCapturePoint: boolean;
  currentCapturePoint: mod.CapturePoint;

  // Spawning
  hasLeftTheGame: boolean;
  shouldRedeploy: boolean;

  // Bot
  isAISoldier: boolean;
  isInsideVehicle: boolean;
  isGoingToReviveRealPlayer: boolean;
  playerToRevive: mod.Player;

  //messageUI;
  debugUI;
  roundStatusUI;

  constructor(player: mod.Player)
  {
    this.id = mod.GetObjId(player);
    this.name = this.id.toString();
    this.player = player;
    this.team = mod.GetTeam(player);
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.flags = 0;
    this.lastWaypointIndex = -1;
    this.waypoint = mod.CreateVector(0,0,0);
    this.isInsideCapturePoint = false;
    this.hasLeftTheGame = false;
    this.shouldRedeploy = false;
    this.isAISoldier = false;
    this.isInsideVehicle = false;
    this.isGoingToReviveRealPlayer = false;
    this.playerToRevive = player;
    this.currentCapturePoint = mod.GetCapturePoint(100);
    //this.messageUI = new MessageUI(this);
    this.debugUI = new MessageDebugUI(this);
    this.roundStatusUI = new RoundStatusUI(this);
  }
}
class PlayersClass
{
  playersList: PlayerClass[];
  constructor()
  {
    this.playersList = [];
  }
  getMyTeamMates(myTeam:mod.Team):PlayerClass[]
  {
    let myTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.Equals(myTeam, this.playersList[i].team))
      {
        // Add team memeber to list.
        myTeamMates.push(this.playersList[i]);
      }
    }
    return myTeamMates;
  }
  getMyRealTeamMates(myTeam:mod.Team):PlayerClass[]
  {
    let myTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.Equals(myTeam, this.playersList[i].team))
      {
        if(!this.playersList[i].isAISoldier)
        {
          // Add the real team memeber to list.
          myTeamMates.push(this.playersList[i]);
        }
      }
    }
    return myTeamMates;
  }
  getEnemyTeamMates(myTeam:mod.Team):PlayerClass[]
  {
    let hisTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(!mod.Equals(myTeam, this.playersList[i].team))
      {
        // Add team memeber to list.
        hisTeamMates.push(this.playersList[i]);
      }
    }
    return hisTeamMates;
  }
}
let Players: PlayersClass;

class CaptureFlagClass
{
  captureFlagId: number;
  capturePoint: mod.CapturePoint;
  flagOwner: mod.Team;
  spawners_Ids: number[];
  position:mod.Vector;

  constructor(capturePoint:mod.CapturePoint)
  {
    this.captureFlagId = mod.GetObjId(capturePoint);
    this.capturePoint = capturePoint;
    this.flagOwner = mod.GetCurrentOwnerTeam(capturePoint);
    this.spawners_Ids = GetAISpawnersForThisFlag(this.captureFlagId);
    this.position = mod.GetObjectPosition(capturePoint);
  }
  changeOwner(newOwner:mod.Team)
  {
    this.flagOwner = newOwner;
  }
}
class CaptureFlagsClass
{
  flagsList: CaptureFlagClass[];
  constructor()
  {
    this.flagsList = [];
  }
  changeOwner(captureFlagId:number, newOwner:mod.Team)
  {
    for(let i = 0; i < this.flagsList.length; i++)
    {
      if(mod.Equals(captureFlagId, this.flagsList[i].captureFlagId))
      {
        // Update owner.
        this.flagsList[i].changeOwner(newOwner);
        break;
      }
    }
  }
  getSpawnersIds(captureFlagId:number):number[]
  {
    for(let i = 0; i < this.flagsList.length; i++)
    {
      if(mod.Equals(captureFlagId, this.flagsList[i].captureFlagId))
      {
        // Update owner.
        return this.flagsList[i].spawners_Ids;
      }
    }
    // Just an empty list.
    return [];
  }
  getMyCaptureFlags(myTeam:mod.Team):CaptureFlagClass[]
  {
    let myFlags = [];
    for(let i = 0; i < this.flagsList.length; i++)
    {
      if(mod.Equals(myTeam, this.flagsList[i].flagOwner))
      {
        // Add flag to list.
        myFlags.push(this.flagsList[i]);
      }
    }
    return myFlags;
  }
  getHisCaptureFlags(myTeam:mod.Team):CaptureFlagClass[]
  {
    let hisFlags = [];
    for(let i = 0; i < this.flagsList.length; i++)
    {
      if(!mod.Equals(myTeam, this.flagsList[i].flagOwner))
      {
        // Add flag to list.
        hisFlags.push(this.flagsList[i]);
      }
    }
    return hisFlags;
  }
  getEmptyCaptureFlags():CaptureFlagClass[]
  {
    let emptyFlags = [];
    for(let i = 0; i < this.flagsList.length; i++)
    {
      if(!mod.Equals(TEAM_HQ1, this.flagsList[i].flagOwner) && !mod.Equals(TEAM_HQ2, this.flagsList[i].flagOwner))
      {
        // Add flag to list.
        emptyFlags.push(this.flagsList[i]);
      }
    }
    return emptyFlags;
  }
}
let CaptureFlags : CaptureFlagsClass
//#endregion

//#region Game Start [DONE]
export async function OnGameModeStarted()
{
  // Create players list.
  Players = new PlayersClass();
  
  // Init capture points.
  InitializeCapturePoints();
  // Init team scores.
  InitializeTeamsScores();
  // Init scoreboard.
  InitializeScoreBoard();
  // Set max score.
  mod.SetGameModeTargetScore(WINNING_SCORE);
  // Start slow timer.
  SlowerTickUpdate();
  // Start fast timer.
  HighTickUpdate();
  // Start Spawner timer.
  SpawnTickUpdate();
  // Spawn AI Bots at start of the round.
  SpawnAIPlayers();
  // AI behavior.
  AIBotsUpdate();
}
// [Done]
function InitializeCapturePoints()
{
  CaptureFlags = new CaptureFlagsClass();
  CAPTURE_POINTS = [];
  Capture_Points_Ids = GetCapturePointsIDs(mod.AllCapturePoints());
  const numberOfCapturePoints = Capture_Points_Ids.length;
  for (let i = 0; i < numberOfCapturePoints; i++) 
  {      
    // Get capture point from game.
    const capturePoint = mod.GetCapturePoint(Capture_Points_Ids[i]);
    // Add it to the list of capture points.
    CAPTURE_POINTS.push(capturePoint);
    // Enable capture point.
    mod.EnableCapturePointDeploying(capturePoint, true);
    mod.EnableGameModeObjective(capturePoint, true);
    // Set capture point time.
    mod.SetCapturePointCapturingTime(capturePoint, CAPTURE_POINT_DURATION);
    // Set capture point loss time.
    mod.SetCapturePointNeutralizationTime(capturePoint, CAPTURE_POINT_DURATION);
    // Set capture point multiplier.
    mod.SetMaxCaptureMultiplier(capturePoint, MaxCaptureMultiplier);

    const flag = new CaptureFlagClass(capturePoint);
    CaptureFlags.flagsList.push(flag);    
  }
}
// [Done]
export async function InitializeTeamsScores()
{
  mod.SetGameModeScore(TEAM_HQ1, 0);
  mod.SetGameModeScore(TEAM_HQ2, 0);
}
// [Done]
export async function InitializeScoreBoard()
{
  mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
  mod.SetScoreboardHeader(mod.Message(mod.stringkeys.teamtickets, team_hq1_tickets), mod.Message(mod.stringkeys.teamtickets, team_hq2_tickets));
  mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.score), mod.Message(mod.stringkeys.kills), mod.Message(mod.stringkeys.deaths), mod.Message(mod.stringkeys.assists), mod.Message(mod.stringkeys.flags));
}
//#endregion

//#region Game Ticks [DONE]
// [Done]
async function HighTickUpdate() 
{
    while (!gameEnded) 
    {
        await mod.Wait(0.1);
        CaptureFlagUpdate();
        CheckForWinState();
        UpdatePlayerPositionDebug();
    }
}
// [Done]
async function SlowerTickUpdate() 
{
    while (!gameEnded) 
    {
        await mod.Wait(1);
        RoundDurationSeconds--;
        if(RoundDurationSeconds <= 0)
        {
          // If time runs out.
          gameEnded = true;
          CheckForWinStateWhenTimeIsUp();
        }
        if(!gameEnded)
        {
          // Update time
          UpdateTimerUIAll();          
          // Update tickets UI.
          UpdateTeamScores();
          // Update tickets UI.
          UpdateTicketsUIAll();
          // Update scoreboard.
          UpdateScoreBoard();
          // Update Capture Flags
          UpdateAllFlags();
          // Adjust AI Difficulty.
          UpdateAIDifficulty();
        }
    }
}
// [Done]
async function SpawnTickUpdate() 
{
    while (!gameEnded) 
    {
        await mod.Wait(0.25);
        // Spawn AI players.
        RespawnAIPlayers();
    }
}
//#endregion

//#region AI Spawn Management Code 40 [DONE]
// [Done] This is called only once at the start of the round
async function SpawnAIPlayers()
{
  //LogFunctionDebugAllPlayers('SpawnAIPlayers', 20400);
  for (let i = 0; i < MAX_PLAYER_COUNT + 5; i++) 
  {
    await mod.Wait(0.1);
    // Add loop here and call this function once at game start.
    if(AIBackfill)
    {
      team_hq1_size = GetTeamCount(TEAM_HQ1);
      team_hq2_size = GetTeamCount(TEAM_HQ2);
      
      if(team_hq1_size < MAX_PLAYER_COUNT / 2)
      {
        const name1 = mod.Message(1000+ i + 1);
        // Spawn to team_hq1
        mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ1), name1, TEAM_HQ1);
      }
      if(team_hq2_size < MAX_PLAYER_COUNT / 2)
      {
        const name2 = mod.Message(2000+ i + 1);
        // Spawn to team_hq2
        mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ2), name2, TEAM_HQ2);
      }      
    }
  }
}
// [Done] This is used when a Bot leaves the game so we need to spawn a new bot in its place "respawn".
async function RespawnAIPlayers()
{
  const numberOfPlayers = Players.playersList.length;
  let numberOfRevivedBots = 0;
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    if(player.hasLeftTheGame)
    {
      player.shouldRedeploy = true;
      if(mod.Equals(player.team,TEAM_HQ1))
      {
        const name1 = mod.Message(1000+ player.id + 1);
        // Spawn to his team.
        mod.SpawnAIFromAISpawner(GetAISpawner(player.team), name1, player.team);
      }
      else
      {
        const name2 = mod.Message(2000+ player.id + 1);
        // Spawn to his team.
        mod.SpawnAIFromAISpawner(GetAISpawner(player.team), name2, player.team);
      }
      
      numberOfRevivedBots++;
      LogFunctionDebug('RespawnAIPlayers', 40000);
    }
  }
}
// [Done] Returns an available spawner for the team.
function GetAISpawner(myTeam:mod.Team): mod.Spawner
{
  let myFlags = CaptureFlags.getMyCaptureFlags(myTeam);
  if(myFlags.length > 0)
  {
    // We have captured flags that we can spawn from.
    let randomFlagIndex = GetRandomIntNumber(0, myFlags.length - 1);
    let spawners = CaptureFlags.getSpawnersIds(myFlags[randomFlagIndex].captureFlagId);
    if(spawners.length == 0)
    {
      // There is an issue. Maybe there aren't any spawners added in the Godot.
      // We do not have any flags so we need to spawn from the HQ
      // Get spawner from any captured flags or from HQ if none.
      if(mod.Equals(myTeam, TEAM_HQ1))
      {
        return mod.GetSpawner(9001);
      }
      else
      {
        return mod.GetSpawner(9002);
      }    
    }
    let randomSpawnIndex = GetRandomIntNumber(0, spawners.length - 1);
    return mod.GetSpawner(spawners[randomSpawnIndex]);
  }
  else
  {
    // We do not have any flags so we need to spawn from the HQ
    // Get spawner from any captured flags or from HQ if none.
    if(mod.Equals(myTeam, TEAM_HQ1))
    {
      return mod.GetSpawner(9001);
    }
    else
    {
      return mod.GetSpawner(9002);
    }    
  }  
}
// [Done] This will trigger when an AISpawner spawns an AI Soldier.
export async function OnSpawnerSpawned(eventPlayer: mod.Player, eventSpawner: mod.Spawner)
{  
  let numberOfPlayers = Players.playersList.length;
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    if(player.shouldRedeploy)
    {
      // Make sure the same AI Bot who left has respawned.
      if(mod.Equals(player.name, player.name))
      {        
        // Reset flags.
        player.shouldRedeploy = false;
        player.hasLeftTheGame = false;
        player.isInsideVehicle = false;
        player.isInsideCapturePoint = false;
        // Update the player
        player.player = eventPlayer;

        LogFunctionDebug('RespawnAIPlayers', 40001);        
      }
    }
  }
}
//#endregion

//#region Kills, Deaths, Assists, Revives. Code 30
// [DONE] Called when a player gets a kill
export async function OnPlayerEarnedKill(player: mod.Player, victim: mod.Player, deathType: mod.PlayerDeathTypes, weapon: mod.Weapons)
{
  let pl = FindPlayer(player);
  let vc = FindPlayer(victim);  
  if(!mod.Equals(pl.player, vc.player))
  {
    pl.kills++;
    pl.score += 100;
    vc.deaths++;
    if(mod.Equals(pl.team, TEAM_HQ1))
    {
      // Player is part of Team 1.
      team_hq2_tickets--;
    }
    else
    {
      // Player is part of Team 2.
      team_hq1_tickets--;
    }    
  }
  else
  {
    // Player has killed himself.
    vc.deaths++;
  }
  LogFunctionDebug('OnPlayerEarnedKill', 30010);
}
// This will trigger whenever a Player dies.
export async function OnPlayerDied(player: mod.Player,otherPlayer: mod.Player,deathType: mod.DeathType,weaponUnlock: mod.WeaponUnlock)
{
  await mod.Wait(1);
  LogFunctionDebug('OnPlayerDied', 30020);
}
// Called when a player gets a kill that he assisted with.
export async function OnPlayerEarnedKillAssist(player: mod.Player, victim: mod.Player)
{
  let pl = FindPlayer(player);
  //let vc = FindPlayer(victim);
  //if(!mod.Equals(pl.player, vc.player))
  //{
    pl.assists++;
    pl.score += 50;
  //}
  LogFunctionDebug('OnPlayerEarnedKillAssist', 30030);
}
// This will trigger when a Player is revived by another Player.
export function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player)
{
  let pl = FindPlayer(eventOtherPlayer);
  pl.score += 100;
  LogFunctionDebug('OnRevived', 30040);
}
//#endregion

//#region Flags Code 10
async function CaptureFlagUpdate()
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    if(player.isInsideCapturePoint)
    {
      const blueCount = GetTeamFlagCount(TEAM_HQ1, player.currentCapturePoint)
      const redCount = GetTeamFlagCount(TEAM_HQ2, player.currentCapturePoint)      
      UpdateCapturePointStatusUIPlayer(player, blueCount, redCount);
    }
  }
}
export async function OnPlayerEnterAreaTrigger(player: mod.Player, areaTrigger: mod.AreaTrigger)
{
  await mod.Wait(0.2);
  let playerc = FindPlayer(player);
  if(!playerc.isAISoldier)
  {
    LogFunctionDebug('OnPlayerEnterAreaTrigger', 10000);
  }
}
// This will trigger when a Player exits an AreaTrigger.
export async function OnPlayerExitAreaTrigger(player: mod.Player, eventAreaTrigger: mod.AreaTrigger)
{
  await mod.Wait(0.2);
  let playerc = FindPlayer(player);
  if(!playerc.isAISoldier)
  {
    LogFunctionDebug('OnPlayerExitAreaTrigger', 10100);
  }
}
// [DONE] This will trigger when a Player enters a CapturePoint capturing area.
export async function OnPlayerEnterCapturePoint(player: mod.Player, capturePoint: mod.CapturePoint)
{  
  // Show Team UI capture point is being captured
  await mod.Wait(0.2);
  // Need to figure out if I am the one who entered the capture point so I can update my UI.
  const playerc = FindPlayer(player);
  playerc.isInsideCapturePoint = true;
  playerc.currentCapturePoint = capturePoint;
  // Play voices.
  for (let i = 0; i < Players.playersList.length; i++) 
  {    
    let plr = Players.playersList[i];
    // Actual player.
    if(mod.Equals(plr.team, mod.GetCurrentOwnerTeam(capturePoint)) && mod.GetTeam(player) != plr.team)
    {
      // Play Voice Someone is trying to capture our flag.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedEnemyGeneric, mod.VoiceOverFlags.Alpha, plr.player);
    }
    else
    {
      // Play voice we are capturing the flag.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedGeneric, mod.VoiceOverFlags.Alpha, plr.player);
    }
  }

  // If an AI Bot enters a capture flag that he owns, select a new waypoint
  let flagOwner = mod.GetCurrentOwnerTeam(capturePoint);
  if(mod.Equals(playerc.team, flagOwner))
  {
    // We already own this flag so we need to select a new waypoint.
    SetAIWaypoint(playerc);
  }
  LogFunctionDebug('OnPlayerEnterCapturePoint',10200);
}
// This will trigger when a Player exits a CapturePoint capturing area.
export async function OnPlayerExitCapturePoint(player: mod.Player, capturePoint: mod.CapturePoint)
{
  await mod.Wait(0.2);
  const playerc = FindPlayer(player);
  playerc.isInsideCapturePoint = false;
  HideCaptureStatusUIPlayer(playerc);
  LogFunctionDebug('OnPlayerExitCapturePoint', 10300);
}
// This will trigger when a team begins capturing a CapturePoint.
export async function OnCapturePointCapturing(capturePoint: mod.CapturePoint)
{
  await mod.Wait(0.2);
  //Timer Flip Flop to fix issue with broken timer settings
  mod.SetCapturePointNeutralizationTime(capturePoint, CAPTURE_POINT_DURATION);
  LogFunctionDebug('OnCapturePointCapturing', 10400);
}
// [DONE] This will trigger when a team takes control of a CapturePoint.
export async function OnCapturePointCaptured(capturePoint: mod.CapturePoint)
{  
  await mod.Wait(0.2);
  //Timer Flip Flop to fix issue with broken timer settings
  mod.SetCapturePointNeutralizationTime(capturePoint, CAPTURE_POINT_DURATION);
  let newOwner = mod.GetCurrentOwnerTeam(capturePoint);
  let flagId = mod.GetObjId(capturePoint);  
  // Update owner.
  CaptureFlags.changeOwner(flagId, newOwner);
  // Get players inside the capture point.
  let players = mod.GetPlayersOnPoint(capturePoint);
  // Get number of 
  let playersCount = SizeOf(players);
  // We have captured an objective.  
  for (let i = 0; i < playersCount; i++) 
  {    
    const player = FindPlayer(ElementAt(players, i) as mod.Player);
    if(mod.Equals(player.team, newOwner))
    {
      // Add score.
      // Give player 200 points.
      player.score += 200;
      player.flags++;
      // Play We have captured an objective voice.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedGeneric, mod.VoiceOverFlags.Alpha, player.player);
      // Get new waypoint.
      SetAIWaypoint(player);
    }
  }
  // We have lost an objective.
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(!mod.Equals(loopPlayer.team, newOwner))
    {
      // Play We have lost an objective voice.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.VoiceOverFlags.Alpha, loopPlayer.player);
    }
  }
  LogFunctionDebug('OnCapturePointCaptured', 10500);
}
// This will trigger when a team loses control of a CapturePoint.
export async function OnCapturePointLost(capturePoint: mod.CapturePoint)
{
  await mod.Wait(0.2);
  // Show Team UI capture point has been lost.
  let other_Team = mod.GetCurrentOwnerTeam(capturePoint);
  // We have lost an objective.
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(!mod.Equals(loopPlayer.team, other_Team))
    {      
      // Play We have lost an objective voice.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.VoiceOverFlags.Alpha, loopPlayer.player);
    }
  }
  LogFunctionDebug('OnCapturePointLost', 10600);
}
//#endregion

//#region Deploy Code 20
// Online players.
export async function OnPlayerJoinGame (player: mod.Player)
{
  //AddPlayer(player);
  // Assign ticket value.
  let joinedPlayer = FindPlayer(player);
  //mod.EnablePlayerDeploy(player, true);

  if(mod.Equals(joinedPlayer.team, TEAM_HQ1))
  {
  }
  else
  {
  }
  LogFunctionDebug('OnPlayerJoinGame', 20000);
}
// This will trigger when any player leaves the game.
export async function OnPlayerLeaveGame(playerId: number)
{
  await mod.Wait(0.25);
  // Flag Player has left the game.
  FlagPlayerHasLeftTheGame(playerId);
  // Need to respawn an AI.
  //SpawnAIPlayer(playerId);
  LogFunctionDebug('OnPlayerLeaveGame', 20100);

}
export async function OnPlayerSwitchTeam(eventPlayer: mod.Player, eventTeam: mod.Team)
{
  
  LogFunctionDebug('OnPlayerSwitchTeam', 20200);
}
export async function OnPlayerDeployed(player: mod.Player)
{
  await mod.Wait(0.5);
  
  //mod.SetRedeployTime(player, 5);  
  
  AddPlayer(player);
  const playerc = FindPlayer(player);
  // Apply difficulty adjustment.
  if(playerc.isAISoldier)
  {
    if(adjust_hq1_difficulty_once)
    {
      if(mod.Equals(playerc.team, TEAM_HQ1))
      {
        mod.SetPlayerMaxHealth(playerc.player,250);
      }
    }
    if(adjust_hq2_difficulty_once)
    {
      if(mod.Equals(playerc.team, TEAM_HQ2))
      {
        mod.SetPlayerMaxHealth(playerc.player,250);
      }
    }
  }


  // Select a waypoint.
  SetAIWaypoint(playerc);
  LogFunctionDebug('OnPlayerDeployed', 20300);
}
// This will trigger when the Player dies and returns to the deploy screen.
export async function OnPlayerUndeploy(player: mod.Player)
{
  await mod.Wait(0.25);
  LogFunctionDebug('OnPlayerUndeploy', 20400);
}
// [Done]
function AddPlayer(player: mod.Player)
{
  const numberOfPlayers = Players.playersList.length;
  if(numberOfPlayers > MAX_PLAYER_COUNT)
  {  
    // To prevent memory leak.
    //LogFunctionDebugAllPlayers('AddPlayer', 20801);
    return;
  }
  
  let isFound = false;
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(mod.Equals(player, loopPlayer.player))
    {
      isFound = true;
    }    
  }
  if(!isFound)
  {
    let pl:PlayerClass
    pl = new PlayerClass(player);
    //mod.SetVariable(mod.ObjectVariable(player, PlayerNameIndex), pl.name);
    

    Players.playersList.push(pl);
  }
  LogFunctionDebug('AddPlayer', 20500);
}
// [Done]
function FlagPlayerHasLeftTheGame(playerId:number)
{
  const numberOfPlayers = Players.playersList.length;
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(mod.Equals(playerId, loopPlayer.id))
    {
      loopPlayer.hasLeftTheGame = true;
      LogFunctionDebug('AddPlayer', 20601);
      break;
    }    
  }
}
//#endregion

//#region AI Bot Behavior Code 50
export async function SetAIWaypoint(player: PlayerClass)
{
  // Check if AI is alive
  if(mod.GetSoldierState(player.player, mod.SoldierStateBool.IsAISoldier) && mod.GetSoldierState(player.player, mod.SoldierStateBool.IsAlive))
  {
    player.isAISoldier = true;
    let emptyFlags = CaptureFlags.getEmptyCaptureFlags();
    let myFlags = CaptureFlags.getMyCaptureFlags(player.team);
    let hisFlags = CaptureFlags.getHisCaptureFlags(player.team);

    // select from which list we want to select our next waypoint.
    let selectedFlags = CaptureFlags.getMyCaptureFlags(player.team);
        
    if(emptyFlags.length > 0)
    {
      // We have empty flags so we want to go to them first.
      selectedFlags = emptyFlags;
    } else if (hisFlags.length > 0)
    {
      // There aren't any empty flags so we want to go to their flags.
      selectedFlags = hisFlags;
    } else if (myFlags.length > 0)
    {
      // We have everything so we want to patorl between our flags.
      selectedFlags = myFlags;
    } else
    {
      // Add Sanity check.      
    }

    let randomIndex = -1;
    let searchIteration = 0;
    let maxSearchIterations = selectedFlags.length * 2;
    do
    {
      // Wait for a bit.
      await mod.Wait(0.25);
      // Get random index number for the capture points.
      randomIndex = GetRandomIntNumber(0, selectedFlags.length - 1);
      searchIteration++;
      if(searchIteration >= maxSearchIterations)
      {
        // We break to avoid getting stuck here when we have a short list to select from.
        break;
      }
      // Make sure we get a new random index.
    }while(player.lastWaypointIndex==randomIndex);
    // Update waypoint index.
    player.lastWaypointIndex = randomIndex;
    // Get capture point.
    //let capturePoint = mod.GetCapturePoint(Capture_Points_Ids[randomIndex]);
    // Get vector of capture point.
    //let capturePoint_position = mod.GetObjectPosition(capturePoint);
    let capturePoint_position = selectedFlags[randomIndex].position;
    // Assign waypoint.
    player.waypoint = capturePoint_position;  
    // Move AI agent.
    mod.AIBattlefieldBehavior(player.player);
    mod.AIDefendPositionBehavior(player.player, capturePoint_position, 1, 10);
    mod.AIMoveToBehavior(player.player, capturePoint_position);
    mod.AISetMoveSpeed(player.player, mod.MoveSpeed.Sprint);
    LogFunctionDebug('SetAIWaypoint', 50000);
  }
}
async function UpdateAIDifficulty()
{
  // Check tickets.
  let team1TicketsPercentage = team_hq1_tickets / WINNING_SCORE;
  if(team1TicketsPercentage <= AIDifficultyPercentage)
  {
    if(!adjust_hq1_difficulty_once)
    {
      // So we enter here only once.
      adjust_hq1_difficulty_once = true;
      // Adjust difficulty.
      //mod.SetPlayerMaxHealth(player,250);
      LogFunctionDebug('UpdateAIDifficulty', 50101);
    }
  }
  let team2TicketsPercentage = team_hq2_tickets / WINNING_SCORE;
  if(team2TicketsPercentage <= AIDifficultyPercentage)
  {
    if(!adjust_hq2_difficulty_once)
    {
      // So we enter here only once.
      adjust_hq2_difficulty_once = true;
      // Adjust difficulty.
      //mod.SetPlayerMaxHealth(player,250);
      LogFunctionDebug('UpdateAIDifficulty', 50102);
    }
  }
}
// This will trigger when a Player takes damage.
export async function OnPlayerDamaged(player: mod.Player, badguy: mod.Player, damageType: mod.DamageType, weaponUnlock: mod.WeaponUnlock)
{
  await mod.Wait(0.1);
  const playerc = FindPlayer(player);
  if (playerc.isAISoldier)
  {
    // Stand your ground and defend.
    let position = mod.GetObjectPosition(player);
    let badguy_position = mod.GetObjectPosition(badguy);
    mod.AIMoveToBehavior(player, position);
    mod.AIDefendPositionBehavior(player, position, 0, 15);
    mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun);
    mod.AISetTarget(badguy);    
    let flag = mod.GetSoldierState(badguy, mod.SoldierStateBool.IsAlive);
    let iNeedToRun = false;
    while(flag)
    {
      // Keep firing at the badguy.      
      await mod.Wait(1);
      const health = mod.GetSoldierState(player, mod.SoldierStateNumber.CurrentHealth);
      if(health < 25)
      {
        flag = false;
        iNeedToRun = true;
        // Run away.
        LogFunctionDebug('OnPlayerDamaged_iNeedToRun', 50201);
        break;
      }
      // Check if we need to keep firing
      position = mod.GetObjectPosition(player);
      badguy_position = mod.GetObjectPosition(badguy);
      const distance = mod.DistanceBetween(position, badguy_position);
      if(distance > 50)
      {
        // Badguy ran away.
        flag = false;
        LogFunctionDebug('OnPlayerDamaged_distance', 50202);
        break;
      }
      const isBadguyAlive = mod.GetSoldierState(badguy, mod.SoldierStateBool.IsAlive);
      if(!isBadguyAlive)
      {
        // Badguy is dead.
        flag = false;
        iNeedToRun = false;
        LogFunctionDebug('OnPlayerDamaged_isBadguyAlive', 50203);
        break;
      }
      LogFunctionDebug('OnPlayerDamaged', 50204);
    }    
    let playerc = FindPlayer(player);
    if(iNeedToRun)
    {
      // Runaway.
      mod.AIMoveToBehavior(player, playerc.waypoint);
      mod.AIDefendPositionBehavior(player, playerc.waypoint, 1, 10);
      mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint);
      LogFunctionDebug('OnPlayerDamaged_iNeedToRun', 50205);
    }
    else
    {
      // Resume mission.
      mod.AIMoveToBehavior(player, playerc.waypoint);
      mod.AIDefendPositionBehavior(player, playerc.waypoint, 1, 10);
      mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun);
      LogFunctionDebug('OnPlayerDamaged_ResumeMission', 50206);
    }    
  }
}
// This will trigger when an AI Soldier reaches target location.
export async function OnAIMoveToSucceeded(player: mod.Player)
{
  await mod.Wait(1);
  // Defend Flag.
  let position = mod.GetObjectPosition(player);
  mod.AIMoveToBehavior(player, position);
  mod.AIDefendPositionBehavior(player, position, 0, 15);
  mod.AISetMoveSpeed(player, mod.MoveSpeed.InvestigateRun);
  LogFunctionDebug('OnAIMoveToSucceeded', 50300);
  await mod.Wait(CAPTURE_POINT_DURATION + 10);
  // Choose a new waypoint.
  let playerc = FindPlayer(player);  
  SetAIWaypoint(playerc);
}
// This will trigger when an AI Soldier stops trying to reach a destination.
export async function OnAIMoveToFailed(eventPlayer: mod.Player)
{
  LogFunctionDebug('OnAIMoveToFailed', 50400);
  await mod.Wait(1);
  let playerc = FindPlayer(eventPlayer);
  // Choose a new waypoint.
  SetAIWaypoint(playerc);
}
// This will trigger when a Player enters a Vehicle seat.
export async function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle)
{
  const player = FindPlayer(eventPlayer);
  player.isInsideVehicle = true;

}
// This will trigger when a Player enters a Vehicle seat.
export function OnPlayerEnterVehicleSeat(eventPlayer: mod.Player, eventVehicle: mod.Vehicle, eventSeat: mod.Object)
{
  const player = FindPlayer(eventPlayer);
  player.isInsideVehicle = true;

}
// This will trigger when a Player exits a Vehicle.
export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle)
{
  const player = FindPlayer(eventPlayer);
  player.isInsideVehicle = false;
}
async function AIBotsUpdate()
{
  while (!gameEnded) 
  {
    await mod.Wait(1);
    for(let i = 0; i < Players.playersList.length; i++)
    {
      // Only apply to AI Bots.
      if(Players.playersList[i].isAISoldier)
      {
        AIBotUpdate(Players.playersList[i]);
      }
    }
  }
}        
async function AIBotUpdate(player: PlayerClass)
{
  let myPosition = mod.GetObjectPosition(player.player);
  let myTeamMates = Players.getMyTeamMates(player.team);
  let enemies = Players.getEnemyTeamMates(player.team);
  let allVehicles = mod.AllVehicles();

  //#region Vehicles
  let vehicleIndex = -1;
  let minVehicleDistance = 10000;
  // Scan for vehicles and use them.
  if(!player.isInsideVehicle)
  { 
    for(let i = 0; i < SizeOf(allVehicles); i++)
    {
      let vehicle = ElementAt(allVehicles, i) as mod.Vehicle;      
      if(!mod.IsVehicleOccupied(vehicle))
      {        
        let distance = mod.DistanceBetween(mod.GetVehicleState(vehicle, mod.VehicleStateVector.VehiclePosition), myPosition);        
        if(distance < minVehicleDistance)
        {
          MessageDebugAllPlayers(2, mod.Message(mod.stringkeys.debuglog2, SizeOf(allVehicles), vehicleIndex, minVehicleDistance), WHITECOLOR);
          // We want the closest vehicle.
          minVehicleDistance = distance;
          vehicleIndex = i;       
        }
      }
    }
  }
  if(vehicleIndex != -1)
  {
    if(minVehicleDistance <= MinimumDistanceToEnterVehicle)
    {
      MessageDebugAllPlayers(3, mod.Message(mod.stringkeys.debuglog3, SizeOf(allVehicles), vehicleIndex, minVehicleDistance), WHITECOLOR);
      // Enter the vehicle.
      let vehicle = ElementAt(allVehicles, vehicleIndex) as mod.Vehicle; 
      if(!mod.IsVehicleOccupied(vehicle))
      {          
        mod.ForcePlayerToSeat(player.player, vehicle, 0);
      }
    }
  }
  //#endregion

  //#region Engagements
  // Scan for enemies and engage with them.
  let minEnemyDistance = 10000;
  let enemyIndex = -1;  
  // Find the closest Enemy.
  for(let i = 0; i < enemies.length; i++)
  {
    let enemy = enemies[i];    
    if(mod.GetSoldierState(enemy.player, mod.SoldierStateBool.IsAlive))
    {      
      let enemyPosition = mod.GetObjectPosition(enemy.player);
      let distance = mod.DistanceBetween(enemyPosition, myPosition);        
      if(distance < minEnemyDistance)
      {
        // We want the closest enemy.
        minEnemyDistance = distance;
        enemyIndex = i;        
      }                
    }
  }
  // Aim at the closest Enemy.
  if(enemyIndex != -1 && minEnemyDistance < MinimumDistanceToDetectEnemies)
  {
    // We have someone to aim at
    // Aim at enemy.
    let enemy = enemies[enemyIndex];
    let enemyPosition = mod.GetObjectPosition(enemy.player);
    let distance = mod.DistanceBetween(enemyPosition, myPosition);    
    mod.AIMoveToBehavior(player.player, enemyPosition);
    mod.AIDefendPositionBehavior(player.player, enemyPosition, 1, MinimumDistanceToDetectEnemies);
    mod.AISetMoveSpeed(player.player, mod.MoveSpeed.InvestigateRun);
    mod.AISetTarget(enemy.player);
    MessageDebugAllPlayers(4, mod.Message(mod.stringkeys.debuglog4, enemies.length, enemyIndex, distance), WHITECOLOR);
  }
  //#endregion
  
  //#region Revives [Done]
  // Scan for downed real players.
  if(!player.isGoingToReviveRealPlayer)
  {
    // Look for someone to revive.
    let myRealTeamMates = Players.getMyRealTeamMates(player.team);
    for(let i = 0; i < myRealTeamMates.length; i++)
    {
      let teamMate = myRealTeamMates[i];
      if(mod.GetSoldierState(teamMate.player, mod.SoldierStateBool.IsManDown))
      {
        LogFunctionDebug('', 90000);
        //onlyOneReviver = true;
        player.isGoingToReviveRealPlayer = true;
        player.playerToRevive = teamMate.player;
        let downedPlayerPosition = mod.GetObjectPosition(teamMate.player);
        //mod.AIMoveToBehavior(player.player, downedPlayerPosition);
        mod.AILOSMoveToBehavior(player.player, downedPlayerPosition);
        mod.AIDefendPositionBehavior(player.player, downedPlayerPosition, 0, MinimumDistanceToRevive);
        mod.AISetMoveSpeed(player.player, mod.MoveSpeed.Sprint);
        // Find first player then break;
        break;
      }    
    }    
  }
  
  // If I have someone I need to revive
  if(player.isGoingToReviveRealPlayer)
  {
    // If we are not the same person
    if(!mod.Equals(player.player, player.playerToRevive))
    {
      // I need to revive the player
      let downedPosition = mod.GetObjectPosition(player.playerToRevive);
      let distance = mod.DistanceBetween(downedPosition, mod.GetObjectPosition(player.player));
      if(distance <= MinimumDistanceToRevive)
      {
        // Revive player.
        mod.ForceRevive(player.playerToRevive);
        // Reset flags
        player.isGoingToReviveRealPlayer = false;
        player.playerToRevive = player.player;
        // We need to reset this flag for everyone.
        for(let i = 0; i < myTeamMates.length; i++)
        {
          myTeamMates[i].isGoingToReviveRealPlayer = false;
          myTeamMates[i].playerToRevive = myTeamMates[i].player;
        }        
        // Find new waypoint
        SetAIWaypoint(player);
      }
      else
      {
        // Run to player
        let downedPlayerPosition = mod.GetObjectPosition(player.playerToRevive);
        //mod.AIMoveToBehavior(player.player, downedPlayerPosition);
        mod.AILOSMoveToBehavior(player.player, downedPlayerPosition);
        mod.AIDefendPositionBehavior(player.player, downedPlayerPosition, 0, MinimumDistanceToRevive);
        mod.AISetMoveSpeed(player.player, mod.MoveSpeed.Sprint);
      }
    }
  }
  //#endregion
}
//#endregion

//#region Game Ended [DONE]
// This will trigger when the gamemode ends.
export function OnGameModeEnding()
{
  gameEnded = true;
}
//#endregion

//#region Win States [DONE]
function CheckForWinState()
{
  if (team_hq1_tickets <= 0)
  {
    // Team_hq1 lost.
    gameEnded = true;
    // Team B won
    mod.EndGameMode(TEAM_HQ2);
    HidePlayersUI();
  } else if (team_hq2_tickets <= 0)
  {
    // Team_hq2 lost.
    gameEnded = true;
    // Team A won.
    mod.EndGameMode(TEAM_HQ1);
    HidePlayersUI();
  }
}
function CheckForWinStateWhenTimeIsUp()
{
  // Check for victory
  if (team_hq1_tickets > team_hq2_tickets)
  {
    mod.EndGameMode(TEAM_HQ1);
    HidePlayersUI();
  } else if (team_hq2_tickets > team_hq1_tickets)
  {
    mod.EndGameMode(TEAM_HQ2);
    HidePlayersUI();
  } else
  {
    // Draw
  }
}
//#endregion

//#region Scores [DONE]
function UpdateTeamScores()
{
  let team1PointsHeld = 0;
  let team2PointsHeld = 0;

  const numberOfCapturePoints = Capture_Points_Ids.length;
  for (let i = 0; i < numberOfCapturePoints; i++) 
  {      
    let capturePoint = mod.GetCapturePoint(Capture_Points_Ids[i]);
    let capturePoint_Owner = mod.GetCurrentOwnerTeam(capturePoint);
    if(mod.Equals(capturePoint_Owner, TEAM_HQ1))
    {
      team1PointsHeld++;
    }
    if(mod.Equals(capturePoint_Owner, TEAM_HQ2))
    {
      team2PointsHeld++;
    }
  }  

  team1ScoreTimer++;
  team2ScoreTimer++;

  const team1Rate = GetTicketsBleedRate(team1PointsHeld);
  const team2Rate = GetTicketsBleedRate(team2PointsHeld);

  if(team1ScoreTimer >= team1Rate && team1Rate > 0)
  {
    // Reset timer.
    team1ScoreTimer = 0;
    team_hq2_tickets--;
  }
  if(team2ScoreTimer >= team2Rate && team2Rate > 0)
  {
    // Reset timer.
    team2ScoreTimer = 0;
    team_hq1_tickets--;
  }
}
function GetTicketsBleedRate(capturePointsHeld: number): number
{
  switch(capturePointsHeld)
  {
    case 5:
      return 1;
    case 4:
      return 2;
    case 3:
      return 3;
    case 2:
      return 4;
    case 1:
      return 5;
    case 0:
      return 0;
    default:
      return 1;
  }
}
function UpdateScoreBoard()
{
  const numberOfPlayers = Players.playersList.length;
  mod.SetScoreboardHeader(mod.Message(mod.stringkeys.teamtickets, team_hq1_tickets), mod.Message(mod.stringkeys.teamtickets, team_hq2_tickets));
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    mod.SetScoreboardPlayerValues(loopPlayer.player, loopPlayer.score, loopPlayer.kills, loopPlayer.deaths, loopPlayer.assists, loopPlayer.flags);
  }
}
//#endregion

//#region Round Status UI
function UpdateTimerUIAll()
{
  let timeTotalSeconds = RoundDurationSeconds;
  let timeTotalMinutes = mod.Floor(timeTotalSeconds / 60);
  let timeRemainingSeconds = mod.Floor(timeTotalSeconds - (timeTotalMinutes * 60));
  let timeText = mod.Message(mod.stringkeys.timer, timeTotalMinutes, timeRemainingSeconds);
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];    
    UpdateTimerUIPlayer(player, timeText);
  }
}
function UpdateTimerUIPlayer(player:PlayerClass, time:mod.Message)
{
  // Only update UI for human players
  if (!player.isAISoldier)
  {
    if (player.roundStatusUI.isOpenRoundStatus()) 
    {
      player.roundStatusUI.refreshTimer(time);
    }
    else
    {
      player.roundStatusUI.openRoundStatus(time);
    }
  }
}
function UpdateTicketsUIAll()
{  
  let blueTicketsText = mod.Message(mod.stringkeys.bluetickets, team_hq1_tickets);
  let redTicketsText = mod.Message(mod.stringkeys.redtickets, team_hq2_tickets);    
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    if(mod.Equals(player.team, TEAM_HQ1))
    {
      blueTicketsText = mod.Message(mod.stringkeys.bluetickets, team_hq1_tickets);
      redTicketsText = mod.Message(mod.stringkeys.redtickets, team_hq2_tickets);
      UpdateTicketsUIPlayer(player, blueTicketsText, redTicketsText, team_hq1_tickets, team_hq2_tickets);
    }
    else
    {
      blueTicketsText = mod.Message(mod.stringkeys.bluetickets, team_hq2_tickets);
      redTicketsText = mod.Message(mod.stringkeys.redtickets, team_hq1_tickets);
      UpdateTicketsUIPlayer(player, blueTicketsText, redTicketsText, team_hq2_tickets, team_hq1_tickets);
    }    
  }
}
function UpdateTicketsUIPlayer(player:PlayerClass, blueTicketsText:mod.Message, redTicketsText:mod.Message, blueTicketsNumber:number, redTicketsNumber:number)
{
  // Only update UI for human players.
  if (!player.isAISoldier)
  {
    if (player.roundStatusUI.isOpenRoundStatus()) 
    {
      player.roundStatusUI.refreshBlueTickets(blueTicketsText, blueTicketsNumber);
    }
    else
    {
      player.roundStatusUI.openRoundStatus(blueTicketsText);
    }
    if (player.roundStatusUI.isOpenRoundStatus()) 
    {
      player.roundStatusUI.refreshRedTickets(redTicketsText, redTicketsNumber);
    }
    else
    {
        player.roundStatusUI.openRoundStatus(redTicketsText);
    }
  }
}
function UpdateAllFlags()
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    UpdateFlagsForPlayer(player); 
  }
}
function UpdateFlagsForPlayer(player:PlayerClass)
{
  // Get latest capture points.
  //const capturePoints = mod.AllCapturePoints();
  const numberOfFlags = CAPTURE_POINTS.length;
  let flags = [];
  for (let i = 0; i < numberOfFlags; i++) 
  {
    const flagOwner = mod.GetCurrentOwnerTeam(CAPTURE_POINTS[i]);
    if(mod.Equals(flagOwner, TEAM_HQ1))
    {
      if(mod.Equals(player.team, TEAM_HQ1))
      {
        flags.push(1);
      }
      else
      {
        flags.push(2);
      }
    }
    else if(mod.Equals(flagOwner, TEAM_HQ2))
    {
      if(mod.Equals(player.team, TEAM_HQ2))
      {
        flags.push(1);
      }
      else
      {
        flags.push(2);
      }
    } else
    {
      // Empty flag.
      flags.push(0);
    }
  }
  if(flags.length > 0)
  {
    UpdateFlagsForPlayerUI(player, flags);
  }
}
function UpdateFlagsForPlayerUI(player:PlayerClass, flags:number[])
{
  if (!player.isAISoldier)
  {
    if (player.roundStatusUI.isOpenRoundStatus()) 
    {
      player.roundStatusUI.refreshCapturePoints(flags);      
    }
    else
    {
      player.roundStatusUI.openRoundStatus(mod.Message('Hello'));
    }
  }
}
function UpdateCapturePointStatusUIPlayer(player:PlayerClass, blueCount:number, redCount:number)
{
  if(!player.isAISoldier)
  {
    let messageBlue = mod.Message(mod.stringkeys.capturestatusblue, blueCount);
    let messageRed = mod.Message(mod.stringkeys.capturestatusred, redCount);
    if(mod.Equals(player.team, TEAM_HQ1))
    {
      messageBlue = mod.Message(mod.stringkeys.capturestatusblue, blueCount);
      messageRed = mod.Message(mod.stringkeys.capturestatusred, redCount);
    }
    else
    {
      messageBlue = mod.Message(mod.stringkeys.capturestatusblue, redCount);
      messageRed = mod.Message(mod.stringkeys.capturestatusred, blueCount);
    }
    // Update UI.
    if (player.roundStatusUI.isOpenCapturePointStatus())
    {
      player.roundStatusUI.refreshCapturePointStatus(messageBlue, messageRed);
    }
    else
    {
      player.roundStatusUI.openCapturePointStatus(messageBlue, messageRed);
    }
  }
}
// Hides the capture point status UI.
function HideCaptureStatusUIPlayer(player:PlayerClass)
{
  if(!player.isAISoldier)
  {
    if (player.roundStatusUI.isOpenCapturePointStatus())
    {
      player.roundStatusUI.closeCapturePointStatus();
    }    
  }
}
//#endregion

//#region Helper Methods
function SizeOf(array:mod.Array):number
{
  return mod.CountOf(array);
}
function ElementAt(array:mod.Array, index:number):any
{
  return mod.ValueInArray(array, index);
}
function GetCapturePointsIDs(capturePoints:mod.Array): number[]
{
  const capturePointsIds = [];
  const numberOfCapturePoints = SizeOf(capturePoints);
  for (let i = 0; i < numberOfCapturePoints; i++) 
  {
    const capturePoint = ElementAt(capturePoints, i) as mod.CapturePoint;
    if(capturePoint)
    {
      const id = mod.GetObjId(capturePoint);
      capturePointsIds.push(id);
    }
  }
  // Sort the list.
  capturePointsIds.sort((a, b) => a - b);
  return capturePointsIds;
}
function GetAISpawnersForThisFlag(captureFlagId:number): number[]
{
  const aiSpawners_Ids = [];
  // captureFlagId = 100 so spawn id starts from 180
  const idStart = captureFlagId + SPAWN_OBJECT_OFFSET;
  let hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(captureFlagId + HIDDEN_OBJECT_OFFSET));
  let numberOfSpawners = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  //mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
  for (let i = idStart; i < idStart + numberOfSpawners; i++)
  {  
    aiSpawners_Ids.push(i);
  }
  return aiSpawners_Ids;
}
function GetTeamFlagCount(team:mod.Team, capturePoint:mod.CapturePoint):number
{
  // Show Team UI capture point is being captured  
    //let team = mod.GetCurrentOwnerTeam(capturePoint);
    let players = mod.GetPlayersOnPoint(capturePoint);
    let playersCount = SizeOf(players);
    let teamCount = 0;
    for (let i = 0; i < playersCount; i++) 
    {
      //const playerc = FindPlayer(mod.ValueInArray(players, i) as mod.Player);
      const playerTeam = mod.GetTeam(ElementAt(players, i) as mod.Player);
      if(mod.Equals(playerTeam, team))
      {
        teamCount++;
      }
    }
    return teamCount;
}
function GetTeamCount(team:mod.Team):number
{
  let count = 0;
  const players = mod.AllPlayers();
  const numberOfPlayers = SizeOf(players);
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = ElementAt(players, i) as mod.Player;
    if (mod.Equals(mod.GetTeam(loopPlayer), team))
    {
      count++;
    }
  }
  return count;
}
function HidePlayersUI()
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    loopPlayer.debugUI.close();
    loopPlayer.roundStatusUI.closeRoundStatus();
    loopPlayer.roundStatusUI.closeCapturePointStatus();
  }
}
function FindPlayer(player: mod.Player):PlayerClass
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(mod.Equals(player, loopPlayer.player))
    {
      return loopPlayer;
    }
  }
  let pl:PlayerClass;
  pl = new PlayerClass(player);
  return pl;
}
function FindPlayerIndexById(playerId: number):number
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(mod.Equals(playerId, loopPlayer.id))
    {
      return i;
    }
  }
  return -1;
}
function GetRandomIntNumber(min: number, max: number):number
{
  // Return a random integer number
  return mod.RoundToInteger(mod.RandomReal(min,max));
}
function GetRandomNumber(min: number, max: number):number
{
  // Return a random number
  return mod.RandomReal(min,max);
}
function GetTeamMembersCount(team: mod.Team):number
{
  let numberOfTeamMembers = 0;
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    if(mod.Equals(team, loopPlayer.team))
    {
      numberOfTeamMembers++;
    }
  }
  return numberOfTeamMembers;
}
//#endregion

//#region Display Notifications
function UpdatePlayerPositionDebug()
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    let player_position = mod.GetObjectPosition(loopPlayer.player);
    let x = mod.XComponentOf(player_position);
    let y = mod.YComponentOf(player_position);
    let z = mod.ZComponentOf(player_position);
    MessageDebugPlayerUI(1, loopPlayer, MakeMessage(mod.stringkeys.debuglog1, x, y, z), BLUETEAMCOLOR);
  }

  GetAISpawnersForThisFlag(100);

  //mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
  const spawner = mod.GetSpawner(9007);
  let position = mod.GetObjectPosition(spawner);
  let x = mod.XComponentOf(position);
  let y = mod.YComponentOf(position);
  let z = mod.ZComponentOf(position);
  //MessageDebugAllPlayers(2, mod.Message(mod.stringkeys.debuglog2, x, y, z), WHITECOLOR);
  
  x = CaptureFlags.flagsList.length;
  y = CaptureFlags.flagsList[0].spawners_Ids.length;
  z = CaptureFlags.flagsList[0].captureFlagId;
  //MessageDebugAllPlayers(3, mod.Message(mod.stringkeys.debuglog3, x, y, z), WHITECOLOR);
}
function DisplayTeamNotification(player:mod.Player, message: string)
{
  let exampleMessage = mod.Message(message);
  let playerTeam = mod.GetTeam(player);
  mod.DisplayNotificationMessage(exampleMessage, playerTeam);
}
function LogFunctionDebugAllPlayers(message:string, messageCode: number)
{
  const exampleMessage = mod.Message(messageCode);
  mod.DisplayCustomNotificationMessage(exampleMessage, mod.CustomNotificationSlots.MessageText1, 0.5);
}
//#endregion

//#region DEBUG
function LogFunctionDebug(message:string, code:number)
{
  if(DEBUG)
  {
    switch(true)
    {
      case 10000<=code && code<20000:
        if(DEBUG_10000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 20000<=code && code<30000:
        if(DEBUG_20000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 30000<=code && code<40000:
        if(DEBUG_30000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 40000<=code && code<50000:
        if(DEBUG_40000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 50000<=code && code<60000:
        if(DEBUG_50000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 60000<=code && code<70000:
        if(DEBUG_60000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 70000<=code && code<80000:
        if(DEBUG_70000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 80000<=code && code<90000:
        if(DEBUG_80000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
      case 90000<=code && code<=99999:
        if(DEBUG_90000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
    }
  }
}
//#endregion

//#region Messages
function MessageAllUI(message: mod.Message, textColor: number[])
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    //if (loopPlayer.messageUI.isOpen()) 
    //{
      //loopPlayer.messageUI.refresh(message);
    //}
    //else
    //{
      //loopPlayer.messageUI.open(message, textColor);
    //}
  }
}
function MessagePlayerUI(player: PlayerClass, message: mod.Message, textColor: number[])
{
  //if (player.messageUI.isOpen()) 
  //{
    //player.messageUI.refresh(message);
  //}
  //else
  //{
    //player.messageUI.open(message, textColor);
  //}
}
function MessageDebugAllPlayers(debugLine: number, message: mod.Message, textColor: number[])
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const loopPlayer = Players.playersList[i];
    MessageDebugPlayerUI(debugLine, loopPlayer, message, textColor);
  }
}
function MessageDebugPlayerUI(debugLine: number, player: PlayerClass, message: mod.Message, textColor: number[])
{
  if(player.isAISoldier)
  {
    return;
  }
  switch(debugLine)
  {
    case 1:
      if (player.debugUI.isOpen()) 
      {
        player.debugUI.refresh1(message);
      }
      else
      {
        player.debugUI.open(message, textColor);
      }
      break;
    case 2:
      if (player.debugUI.isOpen()) 
      {
        player.debugUI.refresh2(message);
      }
      else
      {
        player.debugUI.open(message, textColor);
      }
      break;
    case 3:
      if (player.debugUI.isOpen()) 
      {
        player.debugUI.refresh3(message);
      }
      else
      {
        player.debugUI.open(message, textColor);
      }
      break;
    case 4:
      if (player.debugUI.isOpen()) 
      {
        player.debugUI.refresh4(message);
      }
      else
      {
        player.debugUI.open(message, WHITECOLOR);
      }
      break;
  }
}
function MakeMessage(message: string, ...args: any[])
{
    switch (args.length) {
        case 0:
            return mod.Message(message);
        case 1:
            return mod.Message(message, args[0]);
        case 2:
            return mod.Message(message, args[0], args[1]);
        default:
            return mod.Message(message, args[0], args[1], args[2]);
    }
}
//#endregion

//#region UI Classes
class MessageUI
{
    #jsPlayer;
    #rootWidget: mod.UIWidget|undefined;

    #containerWidth = 700;
    #containerHeight = 100;
    #lineBreakHeight = 3;
    #backgroundSpacing = 4;
    #activeTabBgColor = [0, 0, 0];

    #messageText: mod.UIWidget|undefined;

    #isUIVisible = false;

    constructor(jsPlayer: PlayerClass) {
        this.#jsPlayer = jsPlayer;
    }

    open(message: mod.Message, textColor: number[]) {
        console.log("Open message UI");
        if (!this.#rootWidget)
            this.#create(message, textColor);
        else {
            this.refresh(message);
            if (this.#messageText && textColor.length >= 3)
                mod.SetUITextColor(this.#messageText, mod.CreateVector(textColor[0], textColor[1], textColor[2]));
        }
        
        if (!this.#rootWidget)
            return;

        mod.SetUIWidgetVisible(this.#rootWidget, true);
        this.#isUIVisible = true;
    }

    close() {
        if (this.#rootWidget) {
            mod.SetUIWidgetVisible(this.#rootWidget, false);
            this.#isUIVisible = false;
        }
    }

    isOpen() {
        return this.#isUIVisible;
    }

    refresh(message: mod.Message) {
        console.log("refresh message text with ", );
        if (!this.#messageText)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#messageText, message);

    }

    #create(message: mod.Message, textColor: number[]) {
        // background:
        this.#rootWidget = ParseUI({
            type: "Container",
            size: [this.#containerWidth, this.#containerHeight],
            position: [0, 25],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.#activeTabBgColor,
            bgAlpha: 1,
            playerId: this.#jsPlayer.player,
            children: [{
                // Black Background
                type: "Container",
                position: [0, 0],
                size: [this.#containerWidth - this.#backgroundSpacing, this.#containerHeight - this.#backgroundSpacing],
                anchor: mod.UIAnchor.Center,
                bgFill: mod.UIBgFill.Blur,
                bgColor: BLACKCOLOR,
                bgAlpha: 1,
            },
        ]});
        // message
        this.#messageText = ParseUI({
            type: "Text",
            parent: this.#rootWidget,
            textSize: 36,
            position: [0, 30, 0],
            size: [this.#containerWidth, 50],
            anchor: mod.UIAnchor.BottomCenter,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: textColor,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
    }
}
class MessageDebugUI
{
    #jsPlayer;
    #rootWidget: mod.UIWidget|undefined;

    #containerWidth = 1000;
    #containerHeight = 200;
    #lineBreakHeight = 3;
    #backgroundSpacing = 4;
    #activeTabBgColor = [0, 0, 0];

    #messageText1: mod.UIWidget|undefined;
    #messageText2: mod.UIWidget|undefined;
    #messageText3: mod.UIWidget|undefined;
    #messageText4: mod.UIWidget|undefined;

    #isUIVisible = false;

    constructor(jsPlayer: PlayerClass) {
        this.#jsPlayer = jsPlayer;
    }

    open(message: mod.Message, textColor: number[]) {
        console.log("Open message UI");
        if (!this.#rootWidget)
            this.#create(message, textColor);
        else {
            this.refresh1(message);
            if (this.#messageText1 && textColor.length >= 3)
                mod.SetUITextColor(this.#messageText1, mod.CreateVector(textColor[0], textColor[1], textColor[2]));
            this.refresh2(message);
            if (this.#messageText2 && textColor.length >= 3)
                mod.SetUITextColor(this.#messageText2, mod.CreateVector(textColor[0], textColor[1], textColor[2]));
            this.refresh3(message);
            if (this.#messageText3 && textColor.length >= 3)
                mod.SetUITextColor(this.#messageText3, mod.CreateVector(textColor[0], textColor[1], textColor[2]));
            this.refresh4(message);
            if (this.#messageText4 && textColor.length >= 3)
                mod.SetUITextColor(this.#messageText4, mod.CreateVector(WHITECOLOR[0], WHITECOLOR[1], WHITECOLOR[2]));
        }
        
        if (!this.#rootWidget)
            return;

        mod.SetUIWidgetVisible(this.#rootWidget, true);
        this.#isUIVisible = true;
    }

    close() {
        if (this.#rootWidget) {
            mod.SetUIWidgetVisible(this.#rootWidget, false);
            this.#isUIVisible = false;
        }
    }

    isOpen() {
        return this.#isUIVisible;
    }

    refresh1(message: mod.Message) {
        console.log("refresh message text with ", );
        if (!this.#messageText1)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#messageText1, message);
    }
    refresh2(message: mod.Message) {
        console.log("refresh message text with ", );
        if (!this.#messageText2)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#messageText2, message);
    }
    refresh3(message: mod.Message) {
        console.log("refresh message text with ", );
        if (!this.#messageText3)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#messageText3, message);
    }
    refresh4(message: mod.Message) {
        console.log("refresh message text with ", );
        if (!this.#messageText4)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#messageText4, message);
    }

    #create(message: mod.Message, textColor: number[]) {
        // background:
        this.#rootWidget = ParseUI({
            type: "Container",
            size: [this.#containerWidth, this.#containerHeight],
            position: [0, 25],
            anchor: mod.UIAnchor.BottomCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.#activeTabBgColor,
            bgAlpha: 1,
            playerId: this.#jsPlayer.player,
            children: [{
                // Black Background
                type: "Container",
                position: [0, 0],
                size: [this.#containerWidth - this.#backgroundSpacing, this.#containerHeight - this.#backgroundSpacing],
                anchor: mod.UIAnchor.Center,
                bgFill: mod.UIBgFill.Blur,
                bgColor: BLACKCOLOR,
                bgAlpha: 1,
            },
        ]});
        // message1
        this.#messageText1 = ParseUI({
            type: "Text",
            parent: this.#rootWidget,
            textSize: 12,
            position: [0, 10, 0],
            size: [this.#containerWidth, 50],
            anchor: mod.UIAnchor.BottomCenter,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: textColor,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
        // message2
        this.#messageText2 = ParseUI({
            type: "Text",
            parent: this.#rootWidget,
            textSize: 12,
            position: [0, 25, 0],
            size: [this.#containerWidth, 50],
            anchor: mod.UIAnchor.BottomCenter,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: textColor,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
        // message3
        this.#messageText3 = ParseUI({
            type: "Text",
            parent: this.#rootWidget,
            textSize: 12,
            position: [0, 40, 0],
            size: [this.#containerWidth, 50],
            anchor: mod.UIAnchor.BottomCenter,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: textColor,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
        // message4
        this.#messageText4 = ParseUI({
            type: "Text",
            parent: this.#rootWidget,
            textSize: 12,
            position: [0, 55, 0],
            size: [this.#containerWidth, 50],
            anchor: mod.UIAnchor.BottomCenter,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: textColor,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
    }
}
class RoundStatusUI
{
    #jsPlayer;
    #rootRoundStatusWidget: mod.UIWidget|undefined;
    #rootCapturePointStatusWidget: mod.UIWidget|undefined;

    // We want the status UI like this
    //    83     83      83    250
    // -----------------------
    // |       flags         | 30
    // | Bar            Bar  | 30
    // | TKTS   TIME    TKTS | 30
    // -----------------------
    //                         90
    
    #screenXPosition = 32;
    #screenYPosition = 700;
    #lineBreakHeight = 3;
    #backgroundSpacing = 0;//4;
    #progressBarSpacing = 5;//4;
    #activeTabBgColor = [1, 1, 1];    
    #containerWidth = 255;
    #containerHeight = 90;
    #numberOfRows = 3;
    #numberOfCols = 3;    
    #rowHeight = this.#containerHeight / this.#numberOfRows;
    #colWidth = this.#containerWidth / this.#numberOfCols;
    #progressBarHeight = this.#rowHeight - this.#progressBarSpacing;
    #progressBarWidth = (this.#containerWidth / 2) - this.#progressBarSpacing;
    
    #flagHeight = this.#rowHeight - this.#progressBarSpacing;
    #flagWidth = 0;
    
    
    // Row 0
    #flagsRowIndex = 0;

    // Row 1
    #blueBarRowIndex = 1;
    #blueBarColIndex = 0;
    #redBarRowIndex = 1;
    #redBarColIndex = 0;
    
    // Row 2
    #capturePointLabelTextSize = 18;
    #ticketsTextSize = 24;
    #blueTicketRowIndex = 2;
    #blueTicketColIndex = 0;
    #timerTextSize = 22;
    #timerRowIndex = 2;
    #timerColIndex = 1;
    #redTicketRowIndex = 2;
    #redTicketColIndex = 2;

    #timer: mod.UIWidget|undefined;
    #blueTickets: mod.UIWidget|undefined;
    #redTickets: mod.UIWidget|undefined;
    #blueTicketsProgressBar: mod.UIWidget|undefined;
    #blueTicketsProgressBarBackground: mod.UIWidget|undefined;
    #redTicketsProgressBar: mod.UIWidget|undefined;
    #redTicketsProgressBarBackground: mod.UIWidget|undefined;

    #captureStatusBlue: mod.UIWidget|undefined;
    #captureStatusRed: mod.UIWidget|undefined;

    #isRoundStatusUIVisible = false;
    #isCapturePointStatusUIVisible = false;

    // Flags
    #capturePoints : mod.UIWidget[];
    #capturePointsLabels : mod.UIWidget[];

    constructor(jsPlayer: PlayerClass)
    {
        this.#jsPlayer = jsPlayer;
        // Add flags
        this.#capturePoints = [];
        this.#capturePointsLabels = [];
    }

    //#region Open Close IsOpen
    openRoundStatus(message: mod.Message)
    {
        console.log("Open message UI");
        if (!this.#rootRoundStatusWidget)
        {
            this.#createRoundStatusContainer();
            this.#createTimer(message);
            this.#createBlueTickets(message);
            this.#createRedTickets(message);
            this.#createBlueTicketsProgressBar();
            this.#createRedTicketsProgressBar();
            this.#createCaptureFlagsContainers(5);
        }
        else
        {
            this.refreshTimer(message);
            if (this.#timer)
            {
              mod.SetUITextColor(this.#timer, mod.CreateVector(WHITECOLOR[0], WHITECOLOR[1], WHITECOLOR[2]));
            }
            
            this.refreshBlueTickets(message, WINNING_SCORE);
            if (this.#blueTickets)
            {
              mod.SetUITextColor(this.#blueTickets, mod.CreateVector(BLUETEAMCOLOR[0], BLUETEAMCOLOR[1], BLUETEAMCOLOR[2]));
            }
            
            this.refreshRedTickets(message, WINNING_SCORE);
            if (this.#redTickets)
            {
              mod.SetUITextColor(this.#redTickets, mod.CreateVector(REDTEAMCOLOR[0], REDTEAMCOLOR[1], REDTEAMCOLOR[2]));
            }

            // Flags.
            this.refreshCapturePoints([0,0,0,0,0]);
            if (this.#capturePoints)
            {
              for (let i = 0; i < this.#capturePoints.length; i++) 
              {
                // Hide everything.
                mod.SetUIWidgetBgColor(this.#capturePoints[i], mod.CreateVector(GREYCOLOR[0], GREYCOLOR[1], GREYCOLOR[2]));
                //mod.SetUITextLabel(this.#capturePointsLabels[i], mod.Message(CAPTURE_POINTS_LABELS[i]));
              }
            }
        }
        
        if (!this.#rootRoundStatusWidget)
            return;

        mod.SetUIWidgetVisible(this.#rootRoundStatusWidget, true);
        this.#isRoundStatusUIVisible = true;
    }
    openCapturePointStatus(messageBlue: mod.Message, messageRed: mod.Message)
    {
        console.log("Open message UI");
        if (!this.#rootCapturePointStatusWidget)
        {
            this.#createCapturePointStatusContainer();
            this.#createCaptureStatus(messageBlue, messageRed);
        }
        else
        {            
            this.refreshCapturePointStatus(messageBlue, messageRed);
            if (this.#captureStatusBlue)
                mod.SetUITextColor(this.#captureStatusBlue, mod.CreateVector(BLUETEAMCOLOR[0], BLUETEAMCOLOR[1], BLUETEAMCOLOR[2]));
            if (this.#captureStatusRed)
                mod.SetUITextColor(this.#captureStatusRed, mod.CreateVector(REDTEAMCOLOR[0], REDTEAMCOLOR[1], REDTEAMCOLOR[2]));
        }
        
        if (!this.#rootCapturePointStatusWidget)
            return;

        mod.SetUIWidgetVisible(this.#rootCapturePointStatusWidget, true);
        this.#isCapturePointStatusUIVisible = true;
    }
    closeRoundStatus()
    {
      if (this.#rootRoundStatusWidget)
      {
        mod.SetUIWidgetVisible(this.#rootRoundStatusWidget, false);
        this.#isRoundStatusUIVisible = false;
      }
    }
    closeCapturePointStatus() 
    {
      if (this.#rootCapturePointStatusWidget)
      {
        mod.SetUIWidgetVisible(this.#rootCapturePointStatusWidget, false);
        this.#isCapturePointStatusUIVisible = false;
      }
    }    
    isOpenRoundStatus()
    {
        return this.#isRoundStatusUIVisible;
    }
    isOpenCapturePointStatus()
    {
        return this.#isCapturePointStatusUIVisible;
    }
    //#endregion

    //#region Update
    refreshTimer(message: mod.Message)
    {
        console.log("refresh message text with ", );
        if (!this.#timer)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#timer, message);
    }
    refreshBlueTickets(message: mod.Message, tickets:number)
    {
        console.log("refresh message text with ", );
        if (this.#blueTickets)
        {
          // Update text.
          mod.SetUITextLabel(this.#blueTickets, message);
        }
        if (this.#blueTicketsProgressBar)
        {
          // Update progress bar.
          const width = tickets / WINNING_SCORE;
          mod.SetUIWidgetSize(this.#blueTicketsProgressBar, mod.CreateVector(width * this.#progressBarWidth, this.#progressBarHeight, 1));
        }
    }
    refreshRedTickets(message: mod.Message, tickets:number)
    {
        console.log("refresh message text with ", );
        if (this.#redTickets)
        {
          // Update text.
          mod.SetUITextLabel(this.#redTickets, message);
        }
        if (this.#redTicketsProgressBar)
        {
          // Update progress bar.
          const width = tickets / WINNING_SCORE;
          mod.SetUIWidgetSize(this.#redTicketsProgressBar, mod.CreateVector(width * this.#progressBarWidth, this.#progressBarHeight, 1));
        }
    }
    refreshCapturePoints(flags:number[])
    {
      const numberOfFlags = flags.length;
      
      for (let i = 0; i < numberOfFlags; i++) 
      {
        if (this.#capturePoints)
        {
          switch(flags[i])
          {
            case 0:              
              // Empty flag
              mod.SetUIWidgetBgColor(this.#capturePoints[i], mod.CreateVector(GREYCOLOR[0], GREYCOLOR[1], GREYCOLOR[2]));
              break;
            case 1:
              // Team_HQ1 flag.
              mod.SetUIWidgetBgColor(this.#capturePoints[i], mod.CreateVector(BLUETEAMCOLOR[0], BLUETEAMCOLOR[1], BLUETEAMCOLOR[2]));
              break;
            case 2:
              // Team_HQ2 flag.
              mod.SetUIWidgetBgColor(this.#capturePoints[i], mod.CreateVector(REDTEAMCOLOR[0], REDTEAMCOLOR[1], REDTEAMCOLOR[2]));
              break;
          }        
        }
        if(this.#capturePointsLabels)
        {
          //mod.SetUITextLabel(this.#capturePointsLabels[i], mod.Message(CAPTURE_POINTS_LABELS[i]));
        }
      }      
    }
    refreshCapturePointStatus(messageBlue: mod.Message, messageRed: mod.Message)
    {
        console.log("refresh message text with ", );
        if (!this.#captureStatusBlue)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#captureStatusBlue, messageBlue);
        if (!this.#captureStatusRed)
        {
            console.log("Missing Message Text!");
            return;
        }
        mod.SetUITextLabel(this.#captureStatusRed, messageRed);
    }
    //#endregion

    //#region Creation
    #createRoundStatusContainer()
    {
        // background:
        this.#rootRoundStatusWidget = ParseUI({
            type: "Container",
            size: [this.#containerWidth, this.#containerHeight],
            position: [this.#screenXPosition, this.#screenYPosition],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.#activeTabBgColor,
            bgAlpha: 1,
            playerId: this.#jsPlayer.player,
            children: [{
                // Black Background
                type: "Container",
                position: [0, 0],
                size: [this.#containerWidth - this.#backgroundSpacing, this.#containerHeight - this.#backgroundSpacing],
                anchor: mod.UIAnchor.Center,
                bgFill: mod.UIBgFill.Blur,
                bgColor: BLACKCOLOR,
                bgAlpha: 1,
            },
        ]});
    }
    #createCapturePointStatusContainer()
    {
        // background:
        this.#rootCapturePointStatusWidget = ParseUI({
            type: "Container",
            size: [this.#containerWidth, this.#containerHeight],
            position: [0, 25],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.#activeTabBgColor,
            bgAlpha: 1,
            playerId: this.#jsPlayer.player,
            children: [{
                // Black Background
                type: "Container",
                position: [0, 0],
                size: [this.#containerWidth - this.#backgroundSpacing, this.#containerHeight - this.#backgroundSpacing],
                anchor: mod.UIAnchor.Center,
                bgFill: mod.UIBgFill.Blur,
                bgColor: BLACKCOLOR,
                bgAlpha: 1,
            },
        ]});
    }
    #createTimer(message: mod.Message)
    {
        // timer
        this.#timer = ParseUI({
            type: "Text",
            parent: this.#rootRoundStatusWidget,
            textSize: this.#timerTextSize,
            position: [this.#colWidth * this.#timerColIndex, this.#rowHeight * this.#timerRowIndex, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: WHITECOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
    }
    #createBlueTickets(message: mod.Message)
    {
        // Blue Tickets
        this.#blueTickets = ParseUI({
            type: "Text",
            parent: this.#rootRoundStatusWidget,
            textSize: this.#ticketsTextSize,
            position: [this.#colWidth * this.#blueTicketColIndex, this.#rowHeight * this.#blueTicketRowIndex, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            textColor: BLUETEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
    }
    #createBlueTicketsProgressBar()
    {
        // Blue Tickets Progress bar background.
        this.#blueTicketsProgressBarBackground = ParseUI({
            type: "Container",
            parent: this.#rootRoundStatusWidget,
            size: [this.#progressBarWidth, this.#progressBarHeight],
            position: [this.#colWidth * this.#blueBarColIndex, this.#rowHeight * this.#blueBarRowIndex],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: BLUETEAMCOLORDARK,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Blue Tickets Progress bar.
        this.#blueTicketsProgressBar = ParseUI({
            type: "Container",
            parent: this.#rootRoundStatusWidget,
            size: [this.#progressBarWidth, this.#progressBarHeight],
            position: [this.#colWidth * this.#blueBarColIndex, this.#rowHeight * this.#blueBarRowIndex],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: BLUETEAMCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
    }
    #createRedTickets(message: mod.Message)
    {
        // Red Tickets
        this.#redTickets = ParseUI({
            type: "Text",
            parent: this.#rootRoundStatusWidget,
            textSize: this.#ticketsTextSize,
            position: [this.#colWidth * this.#redTicketColIndex, this.#rowHeight * this.#redTicketRowIndex, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.CenterRight,
            bgAlpha: 0,
            textColor: REDTEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
    }
    #createRedTicketsProgressBar()
    {
        // Red Tickets Progress Bar background.
        this.#redTicketsProgressBarBackground = ParseUI({
            type: "Container",
            parent: this.#rootRoundStatusWidget,
            size: [this.#progressBarWidth, this.#progressBarHeight],
            position: [this.#colWidth * this.#redBarColIndex, this.#rowHeight * this.#redBarRowIndex],
            anchor: mod.UIAnchor.TopRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: REDTEAMCOLORDARK,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Red Tickets Progress Bar.
        this.#redTicketsProgressBar = ParseUI({
            type: "Container",
            parent: this.#rootRoundStatusWidget,
            size: [this.#progressBarWidth, this.#progressBarHeight],
            position: [this.#colWidth * this.#redBarColIndex, this.#rowHeight * this.#redBarRowIndex],
            anchor: mod.UIAnchor.TopRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: REDTEAMCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
    }
    #createCaptureFlagsContainers(numberOfFlags: number)
    {
      this.#capturePoints = [];
      // Get the width for each flag.
      this.#flagWidth = this.#containerWidth / numberOfFlags;      
      for (let i = 0; i < numberOfFlags; i++) 
      {     
        // Empty flag.
        const flagContainer0 = ParseFlagUI({
            type: "Container",
            parent: this.#rootRoundStatusWidget,
            size: [this.#flagWidth, this.#progressBarHeight],
            position: [this.#flagWidth * i, this.#rowHeight * this.#flagsRowIndex],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: GREYCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
        this.#capturePoints.push(flagContainer0);
      }
      for (let i = 0; i < numberOfFlags; i++) 
      {     
        // Empty flag.
        const flagContainer1 = ParseFlagLabelUI({
            type: "Text",
            parent: this.#rootRoundStatusWidget,
            textSize: this.#capturePointLabelTextSize,
            position: [this.#flagWidth * i, this.#rowHeight * this.#flagsRowIndex],
            size: [this.#flagWidth, this.#progressBarHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: WHITECOLOR,
            //bgColor: [1, 0, 0],
            textLabel: CAPTURE_POINTS_LABELS[i]
        });
        this.#capturePointsLabels.push(flagContainer1);
      }
    }
    #createCaptureStatus(messageBlue: mod.Message, messageRed: mod.Message)
    {
        // Capture Status
        this.#captureStatusBlue = ParseUI({
            type: "Text",
            parent: this.#rootCapturePointStatusWidget,
            textSize: 22,
            position: [0, 10, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.CenterLeft,
            textAnchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            textColor: BLUETEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: messageBlue,
        });
        // Capture Status
        this.#captureStatusRed = ParseUI({
            type: "Text",
            parent: this.#rootCapturePointStatusWidget,
            textSize: 22,
            position: [0, 10, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.CenterRight,
            textAnchor: mod.UIAnchor.CenterRight,
            bgAlpha: 0,
            textColor: REDTEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: messageRed,
        });
    }
    //#endregion
}
//#endregion

//#region Create UI

type UIVector = mod.Vector | number[];

interface UIParams {
    name: string;
    type: string;
    position: any;
    size: any;
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible: boolean;
    textLabel: string;
    textColor: UIVector;
    textAlpha: number;
    textSize: number;
    textAnchor: mod.UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: mod.UIBgFill;
    imageType: mod.UIImageType;
    imageColor: UIVector;
    imageAlpha: number;
    teamId?: mod.Team;
    playerId?: mod.Player;
    children?: any[];
    buttonEnabled: boolean;
    buttonColorBase: UIVector;
    buttonAlphaBase: number;
    buttonColorDisabled: UIVector;
    buttonAlphaDisabled: number;
    buttonColorPressed: UIVector;
    buttonAlphaPressed: number;
    buttonColorHover: UIVector;
    buttonAlphaHover: number;
    buttonColorFocused: UIVector;
    buttonAlphaFocused: number;
}

function __asModVector(param: number[]|mod.Vector) {
    if (Array.isArray(param))
        return mod.CreateVector(param[0], param[1], param.length == 2 ? 0 : param[2]);
    else
        return param;
}

function __asModMessage(param: string|mod.Message) {
    if (typeof (param) === "string")
        return mod.Message(param);
    return param;
}

function __fillInDefaultArgs(params: UIParams) {
    if (!params.hasOwnProperty('name'))
        params.name = "";
    if (!params.hasOwnProperty('position'))
        params.position = mod.CreateVector(0, 0, 0);
    if (!params.hasOwnProperty('size'))
        params.size = mod.CreateVector(100, 100, 0);
    if (!params.hasOwnProperty('anchor'))
        params.anchor = mod.UIAnchor.TopLeft;
    if (!params.hasOwnProperty('parent'))
        params.parent = mod.GetUIRoot();
    if (!params.hasOwnProperty('visible'))
        params.visible = true;
    if (!params.hasOwnProperty('padding'))
        params.padding = (params.type == "Container") ? 0 : 8;
    if (!params.hasOwnProperty('bgColor'))
        params.bgColor = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('bgAlpha'))
        params.bgAlpha = 0.5;
    if (!params.hasOwnProperty('bgFill'))
        params.bgFill = mod.UIBgFill.Solid;
}

function __setNameAndGetWidget(uniqueName: any, params: any) {
    let widget = mod.FindUIWidgetWithName(uniqueName) as mod.UIWidget;
    mod.SetUIWidgetName(widget, params.name);
    return widget;
}

const __cUniqueName = "----uniquename----";

function __addUIContainer(params: UIParams) {
    __fillInDefaultArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            restrict);
    } else {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill);
    }
    let widget = __setNameAndGetWidget(__cUniqueName, params);
    if (params.children) {
        params.children.forEach((childParams: any) => {
            childParams.parent = widget;
            __addUIWidget(childParams);
        });
    }
    return widget;
}

function __fillInDefaultTextArgs(params: UIParams) {
    if (!params.hasOwnProperty('textLabel'))
        params.textLabel = "";
    if (!params.hasOwnProperty('textSize'))
        params.textSize = 0;
    if (!params.hasOwnProperty('textColor'))
        params.textColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('textAlpha'))
        params.textAlpha = 1;
    if (!params.hasOwnProperty('textAnchor'))
        params.textAnchor = mod.UIAnchor.CenterLeft;
}

function __addUIText(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultTextArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor,
            restrict);
    } else {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultImageArgs(params: any) {
    if (!params.hasOwnProperty('imageType'))
        params.imageType = mod.UIImageType.None;
    if (!params.hasOwnProperty('imageColor'))
        params.imageColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('imageAlpha'))
        params.imageAlpha = 1;
}

function __addUIImage(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultImageArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha,
            restrict);
    } else {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultArg(params: any, argName: any, defaultValue: any) {
    if (!params.hasOwnProperty(argName))
        params[argName] = defaultValue;
}

function __fillInDefaultButtonArgs(params: any) {
    if (!params.hasOwnProperty('buttonEnabled'))
        params.buttonEnabled = true;
    if (!params.hasOwnProperty('buttonColorBase'))
        params.buttonColorBase = mod.CreateVector(0.7, 0.7, 0.7);
    if (!params.hasOwnProperty('buttonAlphaBase'))
        params.buttonAlphaBase = 1;
    if (!params.hasOwnProperty('buttonColorDisabled'))
        params.buttonColorDisabled = mod.CreateVector(0.2, 0.2, 0.2);
    if (!params.hasOwnProperty('buttonAlphaDisabled'))
        params.buttonAlphaDisabled = 0.5;
    if (!params.hasOwnProperty('buttonColorPressed'))
        params.buttonColorPressed = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('buttonAlphaPressed'))
        params.buttonAlphaPressed = 1;
    if (!params.hasOwnProperty('buttonColorHover'))
        params.buttonColorHover = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaHover'))
        params.buttonAlphaHover = 1;
    if (!params.hasOwnProperty('buttonColorFocused'))
        params.buttonColorFocused = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaFocused'))
        params.buttonAlphaFocused = 1;
}

function __addUIButton(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultButtonArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused,
            restrict);
    } else {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __addUIWidget(params: UIParams) {
    if (params == null)
        return undefined;
    if (params.type == "Container")
        return __addUIContainer(params);
    else if (params.type == "Text")
        return __addUIText(params);
    else if (params.type == "Image")
        return __addUIImage(params);
    else if (params.type == "Button")
        return __addUIButton(params);
    return undefined;
}

export function ParseUI(...params: any[]) {
    let widget: mod.UIWidget|undefined;
    for (let a = 0; a < params.length; a++) {
        widget = __addUIWidget(params[a] as UIParams);
    }
    return widget;
}
export function ParseFlagUI(...params: any[]) : mod.UIWidget
{
  let widget: mod.UIWidget;
  widget = mod.FindUIWidgetWithName('');
  for (let i = 0; i < params.length; i++)
  {
    widget = __addUIContainer(params[i] as UIParams);
  }
  return widget;
}
export function ParseFlagLabelUI(...params: any[]) : mod.UIWidget
{
  let widget: mod.UIWidget;
  widget = mod.FindUIWidgetWithName('');
  for (let i = 0; i < params.length; i++)
  {
    widget = __addUIText(params[i] as UIParams);
  }
  return widget;
}
//#endregion