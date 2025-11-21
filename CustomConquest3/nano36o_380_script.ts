// TODOs:
// AI behaviour
// Add assists to player

//#region Game configuration
let WINNING_SCORE = 100;
let CAPTURE_POINT_DURATION = 10;
let MaxCaptureMultiplier = 1;
let MAX_PLAYER_COUNT = 48;
let RoundDurationMinutes = 10;
let MinimumDistanceToRevive = 2; //meters.
let MinimumDistanceToDetectEnemies = 30; //meters.
let MinimumDistanceToEnterVehicle = 100; // meters.
const BLACKCOLOR: number[] = [1, 1, 1];
const WHITECOLOR: number[] = [1, 1, 1];
const GREYCOLOR: number[] = [0.5, 0.5, 0.5];
const BLUETEAMCOLOR: number[] = [0.56, 0.89, 1];
const BLUETEAMCOLORDARK: number[] = [0.31, 0.5, 0.56];
const REDTEAMCOLOR: number[] = [0.87, 0.54, 0.45];
const REDTEAMCOLORDARK: number[] = [0.55, 0.3, 0.3];
const FILLCOLORSALPHA = 0.35;
const AIBackfill = true;
let AIDifficultyPercentage = 0.33;
let HIDDEN_OBJECT_OFFSET = 70;
let SPAWN_OBJECT_OFFSET = 80;
const HQ1_AI_SPAWNERS_ID_START = 9101;
const HQ2_AI_SPAWNERS_ID_START = 9201;
let HQ1_AI_SPAWNERS_COUNT = 1;
let HQ2_AI_SPAWNERS_COUNT = 1;
const TOTAL_BOTS_COUNT = 36;
const BOT_COUNT_PER_TEAM = TOTAL_BOTS_COUNT / 2;
const CAPTURE_POINTS_LABELS = "ABCDEFGHIJHIJKLMNOPQRSTUVWXYZ";

const NOFDEBUGLINES = 10;
 
const AI_STATIC = false;
const DEBUG = true;
const DEBUG_00000 = false;
const DEBUG_10000 = true;
const DEBUG_20000 = false;
const DEBUG_30000 = false;
const DEBUG_40000 = false;
const DEBUG_50000 = false;
const DEBUG_60000 = false;
const DEBUG_70000 = false;
const DEBUG_80000 = false;
const DEBUG_90000 = false;

// Team assignment tracking
let team1ScoreTimer = 0;
let team2ScoreTimer = 0;
let team_hq1_tickets = WINNING_SCORE;
let team_hq2_tickets = WINNING_SCORE;
let team_hq1_size = 0;
let team_hq2_size = 0;
let adjust_hq1_difficulty_once = false;
let adjust_hq2_difficulty_once = false;
let TEAM_HQ1: mod.Team;
let TEAM_HQ2: mod.Team;
let finishedSpawnAIPlayersOnce = false;

// ---------------------- Config ----------------------
let CAPTURE_POINTS: mod.CapturePoint[];
let Capture_Points_Ids: number[];
let RoundDurationSeconds = 60 * RoundDurationMinutes;
let gameEnded = false;
//#endregion

//#region Classes [DONE]
enum AI_State {
  Reviving,    // 0
  Engaging,  // 1
  RunningToFlag, // 2
  Capturing,  // 3
  Idle, // 4
}

// Player calss used to hold Player's information.
class PlayerClass
{
  // GameObj Id.
  id:number;
  // GameObj Id as string.
  name:string;
  // Player object.
  player: mod.Player;
  speed: mod.MoveSpeed;
  engagedBadguy: mod.Player;
  // Team object.
  team: mod.Team;
  // AI state.
  aiState: AI_State;
  // Player's score.
  score: number;
  // Player's kill count.
  kills: number;
  // Player's death count.
  deaths: number;
  // Player's assists count. [Not working]
  assists: number;
  // Player's capture flags count.
  flags: number;
  // AI Player's latest waypoint. Used with AI Bot.
  lastWaypointIndex:number;
  // Flag used to indicate whether a player is inside or outside a capture flag area.
  isInsideCapturePoint: boolean;
  // Capture flag object once entered its area.
  currentCapturePoint: mod.CapturePoint;
  currentCapturePointLabel: mod.Message;
  currentCapturePointPosition: mod.Vector;
  // Capture flag AI wants to capture.
  nextCapturePoint: mod.CapturePoint;
  nextCapturePointPosition: mod.Vector;

  destinationPosition: mod.Vector;

  // Spawning
  // Flag to indicate an AI Bot has left the game so we can respawn a new one in its place.
  hasLeftTheGame: boolean;
  isDeployed: boolean;

  // Bot
  isAISoldier: boolean;
  isInsideVehicle: boolean;
  playerToRevive: mod.Player;

  //messageUI;
  debugUI;
  roundStatusUI;

  constructor(player: mod.Player)
  {
    this.id = mod.GetObjId(player);
    this.name = this.id.toString();
    this.player = player;
    this.speed = mod.MoveSpeed.Sprint;
    this.engagedBadguy = player;
    this.team = mod.GetTeam(player);
    this.aiState = AI_State.Idle;
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.flags = 0;
    this.lastWaypointIndex = -1;
    this.isInsideCapturePoint = false;
    this.hasLeftTheGame = false;
    this.isDeployed = false;
    this.isAISoldier = false;
    this.isInsideVehicle = false;
    this.playerToRevive = player;
    this.currentCapturePoint = mod.GetCapturePoint(100);
    this.currentCapturePointLabel = mod.Message(mod.stringkeys.A);
    this.currentCapturePointPosition = mod.CreateVector(0,0,0);
    this.nextCapturePoint = mod.GetCapturePoint(100);
    this.nextCapturePointPosition = mod.CreateVector(0,0,0);
    this.destinationPosition = mod.CreateVector(0,0,0);
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
  getMyTeamMates(player:PlayerClass):PlayerClass[]
  {
    let myTeamMates = [];    
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.IsPlayerValid(this.playersList[i].player))
      {
        if(mod.Equals(player.team, this.playersList[i].team))
        {       
          // We do not want to add ourself to thsi list.
          if(!mod.Equals(player.player, this.playersList[i].player))
          {
            // Add team memeber to list.
            myTeamMates.push(this.playersList[i]);
          }
        }
      }
    }
    return myTeamMates;
  }
  getMyRealTeamMates(player:PlayerClass):PlayerClass[]
  {
    let myRealTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.IsPlayerValid(this.playersList[i].player))
      {
        // If it is a valid player.
        if(mod.Equals(player.team, this.playersList[i].team))
        {
          // If we are in the same team.
          if(!this.playersList[i].isAISoldier)
          {
            // Avoid adding ourself.
            if(!mod.Equals(player.player, this.playersList[i].player))
            {
              // Add the real team memeber to list.
              myRealTeamMates.push(this.playersList[i]);
            }
          }
        }
      }
    }
    return myRealTeamMates;
  }
  getEnemyTeamMates(myTeam:mod.Team):PlayerClass[]
  {
    let hisTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.IsPlayerValid(this.playersList[i].player))
      {
        if(!mod.Equals(myTeam, this.playersList[i].team))
        {
          // Add team memeber to list.
          hisTeamMates.push(this.playersList[i]);
        }
      }
    }
    return hisTeamMates;
  }
  getAliveEnemyTeamMates(myTeam:mod.Team):PlayerClass[]
  {
    let hisTeamMates = [];
    for(let i = 0; i < this.playersList.length; i++)
    {
      if(mod.IsPlayerValid(this.playersList[i].player))
      {
        if(!mod.Equals(myTeam, this.playersList[i].team))
        {
          if(mod.GetSoldierState(this.playersList[i].player,mod.SoldierStateBool.IsAlive))
          {
            // Add team memeber to list.
            hisTeamMates.push(this.playersList[i]);
          }
        }
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
  captureFlagLabel:mod.Message;
  flagOwner: mod.Team;
  spawners_Ids: number[];
  position:mod.Vector;

  constructor(capturePoint:mod.CapturePoint, index:number)
  {
    this.captureFlagId = mod.GetObjId(capturePoint);
    this.capturePoint = capturePoint;
    this.flagOwner = mod.GetCurrentOwnerTeam(capturePoint);
    this.spawners_Ids = GetAISpawnersForThisFlag(this.captureFlagId);
    this.position = mod.GetObjectPosition(capturePoint);
    this.captureFlagLabel = mod.Message(CAPTURE_POINTS_LABELS[index]);
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

//#region AI Bot Behavior Code 50
async function StartAIScripts()
{
  // Spawn AI Bots at start of the round.
  SpawnAIPlayers();
  // Start Spawner timer.
  SpawnTickUpdate();
  // AI behavior.
  AIBotsUpdate();  
}
async function AIBotsUpdate()
{
  while (!gameEnded) 
  {
    await mod.Wait(0.2);
    let count1 = 0;
    let count2 = 0;
    let numberOfPlayers = Players.playersList.length;
    for(let i = 0; i < numberOfPlayers; i++)
    {
      let player = Players.playersList[i];
      // Only for valid players.
      if(mod.IsPlayerValid(player.player))
      {
        // Only for existing players.
        if(!player.hasLeftTheGame)
        {
          // Only apply to AI Bots.
          if(player.isAISoldier)
          {
            AIBotUpdate(player);
          }
        }
        else
        {
          count2++;
          if(player.isDeployed)
          {
            player.isDeployed = false;
            mod.ForceManDown(player.player);
            MessageDebugAllPlayers(9,mod.GetObjId(player.player));
          }
        }
      }
      else
      {
        count1++;
        MessageDebugAllPlayers(0,player.id);
      }
    }
    MessageDebugAllPlayers(3, count1, count2);
  }
}
// AI bot frame update.
function AIBotUpdate(player: PlayerClass)
{
  let myPosition = mod.GetObjectPosition(player.player);
  let myTeamMates = Players.getMyTeamMates(player);
  //let enemies = Players.getAliveEnemyTeamMates(player.team);
  //let allVehicles = mod.AllVehicles();

  switch(player.aiState)
  {
    case AI_State.Idle:
      // We need to capture a flag.
      SetAIWaypoint(player);
      break;
    case AI_State.Reviving:
      // Keep going to the human player to revive.
      CheckForRevive(player, myTeamMates);
      break;
    case AI_State.RunningToFlag:
      // Keep going to flag.
      // Check for downed human players.
      if(!CheckForDownedPlayersToRevive(player))
      {
        // Check for engagement.
        // Update movement speed depending of surroundings.
        UpdateMovementSpeed(player);
        // Check for vehicles.        
      }      
      break;
    case AI_State.Capturing:
      // Keep defending the flag.
      // Check for downed human players.
      if(!CheckForDownedPlayersToRevive(player))
      {
        // Defend the flag.
        DefendCapturePoint(player);
      }
      break;
    case AI_State.Engaging:
      // Check for downed human players.
      if(!CheckForDownedPlayersToRevive(player))
      {
        // Enagage with enemy.
        EngageScript(player);
      }
      break;
  }
}
// Selects a capture point for the AI Bot.
function SetAIWaypoint(player: PlayerClass)
{
  if(AI_STATIC)
  {
    return;
  }
  let emptyFlags = CaptureFlags.getEmptyCaptureFlags();    
  let hisFlags = CaptureFlags.getHisCaptureFlags(player.team);
  let myFlags = CaptureFlags.getMyCaptureFlags(player.team);
  
  // Check back here later beacuse sometimes the sum of all flags are above the number of flags in the map.
  //MessageDebugAllPlayers(4, mod.Message(mod.stringkeys.debuglog4, emptyFlags.length, hisFlags.length, myFlags.length), WHITECOLOR);

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
    // Get random index number for the capture points.
    randomIndex = GetRandomIntNumber(0, selectedFlags.length - 1);
    // Increase search count.
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
  // Move AI agent.
  mod.AIBattlefieldBehavior(player.player);
  player.nextCapturePoint = selectedFlags[randomIndex].capturePoint;
  player.nextCapturePointPosition = mod.GetObjectPosition(player.nextCapturePoint);
  player.destinationPosition = selectedFlags[randomIndex].position;
  SetAIState(player, AI_State.RunningToFlag);
  SetAIBotMovementBehavior(player);
  LogFunctionDebug('SetAIWaypoint', 50000);
}
function SetAIBotMovementBehavior(player:PlayerClass)
{  
  if(player.aiState == AI_State.Reviving)
  {
    // Always run to revive the human player regardless of any threats around the AI Bot.
    SetAIBotMovementSpeed(player, mod.MoveSpeed.Sprint);
    SetAIMoveTo(player);
  }
  else
  {
    // Running to flag.
    if(CheckForEnemies(player))
    {
      // Move with caution.
      SetAIBotMovementSpeed(player, mod.MoveSpeed.InvestigateRun);
      DefendCapturePoint(player);
    }
    else
    {
      // Run towards the capture flag.
      SetAIBotMovementSpeed(player, mod.MoveSpeed.Sprint);
      SetAIMoveTo(player);
    }
  }  
}
function SetAIBotMovementSpeed(player:PlayerClass, speed:mod.MoveSpeed)
{
  // Update speed property.
  player.speed = speed;
  // Set movement speed.
  mod.AISetMoveSpeed(player.player, speed);
}
function SetAIMoveTo(player:PlayerClass)
{
  mod.AIMoveToBehavior(player.player, player.destinationPosition);
}
function SetAIBotDefend(player:PlayerClass, destination:mod.Vector, minimumDistance:number, maximumDistance:number)
{
  mod.AIDefendPositionBehavior(player.player, destination, minimumDistance, maximumDistance);
}
function UpdateAIDifficulty()
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
function DamagedBehavior(player: PlayerClass, badguy: mod.Player, damageType: mod.DamageType, weaponUnlock: mod.WeaponUnlock)
{
  SetAIState(player, AI_State.Engaging);
  player.engagedBadguy = badguy;    
}
// This will trigger when an AI Soldier reaches target location.
export async function OnAIMoveToSucceeded(eventPlayer: mod.Player)
{
  await mod.Wait(0.2);
  LogFunctionDebug('OnAIMoveToSucceeded', 50300);
  let player = FindPlayer(eventPlayer);  
  SetAIState(player, AI_State.Idle);
}
// This will trigger when an AI Soldier stops trying to reach a destination.
export async function OnAIMoveToFailed(eventPlayer: mod.Player)
{
  LogFunctionDebug('OnAIMoveToFailed', 50400);
  await mod.Wait(0.2);
  let player = FindPlayer(eventPlayer);
  SetAIState(player, AI_State.Idle);
}
// Sets the state of the ai bot.
function SetAIState(aiBot: PlayerClass, aiState:AI_State)
{
  aiBot.aiState = aiState;
  //LogFunctionDebug('SetAIState', aiBot.aiState);
}
function UpdateMovementSpeed(player: PlayerClass)
{
  SetAIBotMovementBehavior(player);
}
function CheckForEnemies(player:PlayerClass):boolean
{
  let myPosition = mod.GetObjectPosition(player.player);
  let enemies = Players.getAliveEnemyTeamMates(player.team);
  // Find if any enemy is close.
  for(let i = 0; i < enemies.length; i++)
  {
    let enemy = enemies[i];                 
    let enemyPosition = mod.GetObjectPosition(enemy.player);
    let distance = mod.DistanceBetween(enemyPosition, myPosition);     
    // Add later checking with 2 different distances. One longer distance within FOV of Bot and one shoter distance for surrounding Bot.
    if(distance < MinimumDistanceToDetectEnemies)
    {
      // There is someone close.
      return true;
    }          
  }
  // No one is close.
  return false;
}
function CheckForDownedPlayersToRevive(player:PlayerClass): boolean
{
  // Look for someone to revive.
  let myRealTeamMates = Players.getMyRealTeamMates(player);
  for(let i = 0; i < myRealTeamMates.length; i++)
  {
    let teamMate = myRealTeamMates[i];
    if(mod.GetSoldierState(teamMate.player, mod.SoldierStateBool.IsManDown))
    {
      LogFunctionDebug('PlayerIsManDown', 90000);
      SetAIState(player, AI_State.Reviving);
      player.playerToRevive = teamMate.player;
      player.destinationPosition = mod.GetObjectPosition(teamMate.player);
      SetAIBotMovementBehavior(player);
      // This will check for the first downed player.
      return true;
    }
  }
  return false;
}
function CheckForRevive(player:PlayerClass, myTeamMates:PlayerClass[])
{
  // If I have someone I need to revive
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
      SetAIState(player, AI_State.Idle);
      player.playerToRevive = player.player;
      // We need to reset this flag for everyone.
      for(let i = 0; i < myTeamMates.length; i++)
      {
        SetAIState(myTeamMates[i], AI_State.Idle);
        myTeamMates[i].playerToRevive = myTeamMates[i].player;
      }        
    }
    else
    {
      // Run to player.
      //player.destinationPosition = mod.GetObjectPosition(player.playerToRevive);
      //SetAIBotMovementSprint(player);
    }
  }
  else
  {
    SetAIState(player, AI_State.Idle);
  }
}
function EngageScript(player:PlayerClass)
{
    // Stand your ground and defend.
    let position = mod.GetObjectPosition(player.player);
    let badguy_position = mod.GetObjectPosition(player.engagedBadguy);    
    SetAIBotDefend(player, position, 1, 2);
    mod.AISetTarget(player.engagedBadguy);
    let health = mod.GetSoldierState(player.engagedBadguy, mod.SoldierStateNumber.CurrentHealth);
    let distance = mod.DistanceBetween(position, badguy_position);
    let isBadguyAlive = mod.GetSoldierState(player.engagedBadguy, mod.SoldierStateBool.IsAlive);    
    if(health < 25)
    {
      //SetAIState(player, AI_State.Idle);
      // Run away.
      LogFunctionDebug('OnPlayerDamaged_iNeedToRun', 50201);        
    }    
    if(distance > MinimumDistanceToDetectEnemies)
    {
      // Badguy ran away.
      //SetAIState(player, AI_State.Idle);
    }
    if(!isBadguyAlive)
    {
      // Badguy is dead.
      SetAIState(player, AI_State.Idle);
      LogFunctionDebug('OnPlayerDamaged_isBadguyAlive', 50203);
    }        
}
function DefendCapturePoint(player:PlayerClass)
{
  SetAIBotDefend(player, player.destinationPosition, 1, 7);
}
//#endregion

//#region AI Spawn Management Code 40
// [Done] This is called only once at the start of the round
async function SpawnAIPlayers()
{
  // HQ1.
  for (let i = 1; i <= BOT_COUNT_PER_TEAM; i++) 
  {
    await mod.Wait(0.25);
    // Add loop here and call this function once at game start.
    if(AIBackfill)
    {
      // Team 1.
      let name1 = mod.Message(i);
      // Spawn to team_hq1
      mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ1), name1, TEAM_HQ1);
    }
  }
  // HQ2.
  for (let i = BOT_COUNT_PER_TEAM + 1; i <= MAX_PLAYER_COUNT; i++) 
  {
    await mod.Wait(0.25);
    // Add loop here and call this function once at game start.
    if(AIBackfill)
    {
      // Team 2.
      let name2 = mod.Message(i);
      // Spawn to team_hq2
      mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ2), name2, TEAM_HQ2);
    }
  }

  finishedSpawnAIPlayersOnce = true;
}
// [Done] This is used when a Bot leaves the game so we need to spawn a new bot in its place "respawn".
async function RespawnAIPlayers()
{
  if(!finishedSpawnAIPlayersOnce)
  {
    // We don't want to run this method if we did not finish spawing all players at the beginning of the round.
    return;
  }
  // Get actual current players.
  let players =  mod.AllPlayers();
  let nofPlayers = SizeOf(players);
  let team1Count = 0;
  let team2Count = 0;
  let team1Ids = [];
  let team2Ids = [];
  for(let i = 0; i < nofPlayers; i++)
  {    
    let player = ElementAt(players, i) as mod.Player;
    // If player is valid.
    if(mod.IsPlayerValid(player))
    {
      // Only count the AI Bots.
      if(mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier))
      {
        if(mod.Equals(mod.GetTeam(player), TEAM_HQ1))
        {
          team1Count++;
          team1Ids.push(mod.GetObjId(player));
        }
        else
        {
          team2Count++;
          team2Ids.push(mod.GetObjId(player));
        }
      }
    }
  }
  MessageDebugAllPlayers(1, nofPlayers, team1Count, team2Count);
  // Sort the ids.
  team1Ids.sort((a, b) => a - b);
  team2Ids.sort((a, b) => a - b);
  if(team1Count < BOT_COUNT_PER_TEAM)
  {
    // This team is missing players.
    // Need to find out the missing Id to respawn
    let id = FindMissingIds(1, BOT_COUNT_PER_TEAM, team1Ids);
    // Team 1 starts from 1 to 18
    // Team 1.
    let name1 = mod.Message(id);
    // Spawn to team_hq1
    mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ1), name1, TEAM_HQ1);
  }
  if(team2Count < BOT_COUNT_PER_TEAM)
  {
    // This team is missing players.
    // Need to find out the missing Id to respawn
    // Team 2 starts from 19 to 36
    let id = FindMissingIds(BOT_COUNT_PER_TEAM + 1, BOT_COUNT_PER_TEAM + BOT_COUNT_PER_TEAM, team2Ids);
    // Team 2.
    let name2 = mod.Message(id);
    // Spawn to team_hq1
    mod.SpawnAIFromAISpawner(GetAISpawner(TEAM_HQ2), name2, TEAM_HQ2);
  }
  LogFunctionDebug('RespawnAIPlayers', 40000);
}
function FindMissingIds(startId:number, endId:number, ids:number[]):number
{
  for(let id = startId; id <= endId; id++)
  {
    let found = false;
    for(let j = 0; j < ids.length; j++)
    {
      if(id == ids[j])
      {
        found = true;
        break;
      }
    }
    if(!found)
    {
      return id;
    }
  }
  return startId;
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
        return mod.GetSpawner(GetRandomIntNumber(HQ1_AI_SPAWNERS_ID_START, HQ1_AI_SPAWNERS_ID_START + HQ1_AI_SPAWNERS_COUNT - 1));
      }
      else
      {
        return mod.GetSpawner(GetRandomIntNumber(HQ2_AI_SPAWNERS_ID_START, HQ2_AI_SPAWNERS_ID_START + HQ2_AI_SPAWNERS_COUNT - 1));
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
      return mod.GetSpawner(GetRandomIntNumber(HQ1_AI_SPAWNERS_ID_START, HQ1_AI_SPAWNERS_ID_START + HQ1_AI_SPAWNERS_COUNT - 1));
    }
    else
    {
      return mod.GetSpawner(GetRandomIntNumber(HQ2_AI_SPAWNERS_ID_START, HQ2_AI_SPAWNERS_ID_START + HQ2_AI_SPAWNERS_COUNT - 1));
    }    
  }  
}
// [Done] This will trigger when an AISpawner spawns an AI Soldier.
export async function OnSpawnerSpawned(eventPlayer: mod.Player, eventSpawner: mod.Spawner)
{  
  let aiBotId = mod.GetObjId(eventPlayer);
  let numberOfPlayers = Players.playersList.length;
  let found = false;
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    let player = Players.playersList[i];
    // Make sure the same AI Bot who left has respawned.
    if(player.id == aiBotId)
    {
      found = true;
      //mod.SetTeam(eventPlayer, player.team);
      // Reset flags.
      player.isInsideVehicle = false;
      player.isInsideCapturePoint = false;
      // Update the player
      player.player = eventPlayer;
      player.team = mod.GetTeam(eventPlayer);
      player.hasLeftTheGame = false;
      SetAIState(player, AI_State.Idle);      
      LogFunctionDebug('RespawnAIPlayers', 40001);        
    }
  }
  if(!found)
  {
    LogFunctionDebug('OnSpawnerSpawned',40002);
    // Ai bot could not be matched to an existing player.
    MessageDebugAllPlayers(2,aiBotId);
  }
}
//#endregion

//#region Game Start [DONE]
export async function OnGameModeStarted()
{
  // Get game configuration from Spatial objects data.
  GetGameConfigurationFromSpatialObjects();
  // Apply configurations from spatial objects data.
  ApplyGameConfigurationFromSpatialObjects();

  TEAM_HQ1 = mod.GetTeam(1); // HQ1
  TEAM_HQ2 = mod.GetTeam(2); // HQ2
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
  // Start AI scripts.
  StartAIScripts();  
}
function GetGameConfigurationFromSpatialObjects()
{
  let configId = 900001;
  let hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  let configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  WINNING_SCORE = configValue;
  configId = 900002;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  CAPTURE_POINT_DURATION = configValue;
  configId = 900003;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  MaxCaptureMultiplier = configValue;
  configId = 900004;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  MAX_PLAYER_COUNT = configValue;
  MAX_PLAYER_COUNT = TOTAL_BOTS_COUNT;
  configId = 900005;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  RoundDurationMinutes = configValue;
  configId = 900006;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  MinimumDistanceToRevive = configValue; //meters.
  configId = 900007;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  MinimumDistanceToDetectEnemies = configValue; //meters.
  configId = 900008;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  MinimumDistanceToEnterVehicle = configValue; // meters.
  configId = 900009;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject)) / 100;
  AIDifficultyPercentage = configValue;
  configId = 900010;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  HIDDEN_OBJECT_OFFSET = configValue;
  configId = 900011;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  SPAWN_OBJECT_OFFSET = configValue;
  configId = 900012;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  HQ1_AI_SPAWNERS_COUNT = configValue;
  configId = 900013;
  hiddenObject = mod.GetObjectPosition(mod.GetSpatialObject(configId));
  configValue = mod.RoundToInteger(mod.XComponentOf(hiddenObject));
  HQ2_AI_SPAWNERS_COUNT = configValue;
}
function GetGameConfigurationFromSpatialObjects2()
{
  WINNING_SCORE = 500;
  CAPTURE_POINT_DURATION = 10;
  MaxCaptureMultiplier = 1;
  MAX_PLAYER_COUNT = 48;
  MAX_PLAYER_COUNT = TOTAL_BOTS_COUNT;
  RoundDurationMinutes = 10;
  MinimumDistanceToRevive = 2; //meters.
  MinimumDistanceToDetectEnemies = 30; //meters.
  MinimumDistanceToEnterVehicle = 10; // meters.
  AIDifficultyPercentage = 0.33;
  HIDDEN_OBJECT_OFFSET = 70;
  SPAWN_OBJECT_OFFSET = 80;
}
function ApplyGameConfigurationFromSpatialObjects()
{
  team_hq1_tickets = WINNING_SCORE;
  team_hq2_tickets = WINNING_SCORE;
  RoundDurationSeconds = 60 * RoundDurationMinutes;
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
    // Create new flag class.
    const flag = new CaptureFlagClass(capturePoint, i);
    // Add flag to list.
    CaptureFlags.flagsList.push(flag);    
  }
}
// [Done]
function InitializeTeamsScores()
{
  mod.SetGameModeScore(TEAM_HQ1, 0);
  mod.SetGameModeScore(TEAM_HQ2, 0);
}
// [Done]
function InitializeScoreBoard()
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
        await mod.Wait(1);
        // Spawn AI players.
        RespawnAIPlayers();
    }
}
//#endregion

//#region Kills, Damages, Deaths, Assists, Revives. Code 30 [DONE]
// [DONE] Called when a player gets a kill
export async function OnPlayerEarnedKill(player: mod.Player, victim: mod.Player, deathType: mod.PlayerDeathTypes, weapon: mod.Weapons)
{
  await mod.Wait(0.2);
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
// This will trigger when a Player takes damage.
export async function OnPlayerDamaged(eventPlayer: mod.Player, badguy: mod.Player, damageType: mod.DamageType, weaponUnlock: mod.WeaponUnlock)
{
  await mod.Wait(0.1);
  let player = FindPlayer(eventPlayer);
  let otherGuy = FindPlayer(badguy);
  otherGuy.score += 1;
  DamagedBehavior(player, badguy, damageType, weaponUnlock);
}
// This will trigger whenever a Player dies.
export async function OnPlayerDied(eventPlayer: mod.Player,otherPlayer: mod.Player,deathType: mod.DeathType,weaponUnlock: mod.WeaponUnlock)
{
  await mod.Wait(0.3);
  LogFunctionDebug('OnPlayerDied', 30020);
}
// Called when a player gets a kill that he assisted with.
export async function OnPlayerEarnedKillAssist(eventPlayer: mod.Player, victim: mod.Player)
{
  await mod.Wait(0.2);  
  let player = FindPlayer(eventPlayer);
  player.assists++;
  player.score += 50;
  LogFunctionDebug('OnPlayerEarnedKillAssist', 30030);
}
// This will trigger when a Player is revived by another Player.
export async function OnRevived(eventPlayer: mod.Player, eventOtherPlayer: mod.Player)
{
  await mod.Wait(0.2);
  let pl = FindPlayer(eventOtherPlayer);
  pl.score += 100;
  LogFunctionDebug('OnRevived', 30040);
}
//#endregion

//#region Flags Code 10 [DONE]
function CaptureFlagUpdate()
{  
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    let player = Players.playersList[i];
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      if(player.isInsideCapturePoint)
      {
        UpdateCapturePointStatusUIPlayer(player);
      }
    }
  }
}
// [DONE] This will trigger when a Player enters a CapturePoint capturing area.
export async function OnPlayerEnterCapturePoint(eventPlayer: mod.Player, capturePoint: mod.CapturePoint)
{  
  // Show Team UI capture point is being captured
  await mod.Wait(0.2);
  // Get team owner of this flag.
  let flagOwner = mod.GetCurrentOwnerTeam(capturePoint);
  // Need to figure out if I am the one who entered the capture point so I can update my UI.
  let player = FindPlayer(eventPlayer);
  // This is used for humans to show the UI.
  player.isInsideCapturePoint = true;
  // Update the current capture flag.
  player.currentCapturePoint = capturePoint;
  // Update capture point label.
  player.currentCapturePointLabel = GetCapturePointLabel(capturePoint);
  // Update the position of the capture point.
  player.currentCapturePointPosition = player.nextCapturePointPosition;
  if(player.aiState == AI_State.RunningToFlag)
  {
    // Is this the intented flag to capture?
    if(mod.Equals(capturePoint, player.nextCapturePoint))
    {
      // If we do not own the flag already.
      if(!mod.Equals(player.team, flagOwner))
      {
        LogFunctionDebug('OnPlayerEnterCapturePoint',10201);
        // Update AI state. 
        SetAIState(player, AI_State.Capturing);
      }
      else
      {
        LogFunctionDebug('OnPlayerEnterCapturePoint',10202);
        // We already own this flag so we need to select a new waypoint.
        SetAIState(player, AI_State.Idle);
      }
    }
  }
  else
  {
    LogFunctionDebug('OnPlayerEnterCapturePoint',10203);
  }
}
function PlayVoices(capturePoint:mod.CapturePoint, player:PlayerClass)
{
  // Play voices.
  let numberOfPlayers = Players.playersList.length;
  for (let i = 0; i < numberOfPlayers; i++) 
  {    
    let plr = Players.playersList[i];
    // Actual player.
    if(mod.Equals(plr.team, mod.GetCurrentOwnerTeam(capturePoint)) && mod.GetTeam(player.player) != plr.team)
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

}
// This will trigger when a Player exits a CapturePoint capturing area.
export async function OnPlayerExitCapturePoint(eventPlayer: mod.Player, capturePoint: mod.CapturePoint)
{
  await mod.Wait(0.1);
  let player = FindPlayer(eventPlayer);
  player.isInsideCapturePoint = false;
  HideCaptureStatusUIPlayer(player);
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
    let player = FindPlayer(ElementAt(players, i) as mod.Player);
    if(mod.Equals(player.team, newOwner))
    {
      // Add score.
      // Give player 200 points.
      player.score += 200;
      player.flags++;
      // Play We have captured an objective voice.
      mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedGeneric, mod.VoiceOverFlags.Alpha, player.player);
      LogFunctionDebug('OnCapturePointCaptured', 10501);
      SetAIState(player, AI_State.Idle);
    }
  }
  // We have lost an objective.
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    let player = Players.playersList[i];
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      if(!mod.Equals(player.team, newOwner))
      {
        // Play We have lost an objective voice.
        mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.VoiceOverFlags.Alpha, player.player);
      }
    }
  }
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
    let player = Players.playersList[i];
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      if(!mod.Equals(player.team, other_Team))
      {      
        // Play We have lost an objective voice.
        mod.PlayVO(mod.GetVO(0), mod.VoiceOverEvents2D.ObjectiveCapturedEnemy, mod.VoiceOverFlags.Alpha, player.player);
      }
    }
  }
  LogFunctionDebug('OnCapturePointLost', 10600);
}
//#endregion

//#region Deploy Code 20 [DONE]
// Online players.
export async function OnPlayerJoinGame (player: mod.Player)
{
  //AddPlayer(player);
  // Assign ticket value.
  //let joinedPlayer = FindPlayer(player);
  //mod.EnablePlayerDeploy(player, true);
  LogFunctionDebug('OnPlayerJoinGame', 20000);
}
// This will trigger when any player leaves the game.
export async function OnPlayerLeaveGame(playerId: number)
{
  await mod.Wait(0.1);
  // Flag Player has left the game.
  FlagPlayerHasLeftTheGame(playerId);
  LogFunctionDebug('OnPlayerLeaveGame', 20100);
}
export async function OnPlayerSwitchTeam(eventPlayer: mod.Player, eventTeam: mod.Team)
{
  LogFunctionDebug('OnPlayerSwitchTeam', 20200);
}
export async function OnPlayerDeployed(eventPlayer: mod.Player)
{
  await mod.Wait(0.5);
  if(mod.IsPlayerValid(eventPlayer))
  {
    AddPlayer(eventPlayer);
    const player = FindPlayer(eventPlayer);
    player.isDeployed = true;
    
    if(mod.GetSoldierState(player.player, mod.SoldierStateBool.IsAISoldier))
    {
      player.isAISoldier = true;
    }  
    SetAIState(player, AI_State.Idle);
    // Apply difficulty adjustment.
    if(player.isAISoldier)
    {
      if(adjust_hq1_difficulty_once)
      {
        if(mod.Equals(player.team, TEAM_HQ1))
        {
          mod.SetPlayerMaxHealth(player.player,250);
        }
      }
      if(adjust_hq2_difficulty_once)
      {
        if(mod.Equals(player.team, TEAM_HQ2))
        {
          mod.SetPlayerMaxHealth(player.player,250);
        }
      }
    }  
    LogFunctionDebug('OnPlayerDeployed', 20301);
  }
  else
  {
    // Player is not valid
    mod.ForceManDown(eventPlayer);
    MessageDebugAllPlayers(8,mod.GetObjId(eventPlayer));
    LogFunctionDebug('OnPlayerDeployed', 20302);
  }  
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
    Players.playersList.push(pl);
  }
  LogFunctionDebug('AddPlayer', 20500);
}
// [Done]
function FlagPlayerHasLeftTheGame(playerId:number)
{
  let playerIndex = FindPlayerIndexById(playerId);
  if(playerIndex == -1)
  {
    return;
  }
  let player = Players.playersList[playerIndex];
  player.hasLeftTheGame = true;
  player.isDeployed = false;
  SetAIState(player, AI_State.Idle);
}
//#endregion

//#region Vehicles Code 60
// This will trigger when a Player enters a Vehicle seat.
export async function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle)
{
  let player = FindPlayer(eventPlayer);
  player.isInsideVehicle = true;

}
// This will trigger when a Player enters a Vehicle seat.
export async function OnPlayerEnterVehicleSeat(eventPlayer: mod.Player, eventVehicle: mod.Vehicle, eventSeat: mod.Object)
{
  let player = FindPlayer(eventPlayer);
  player.isInsideVehicle = true;

}
// This will trigger when a Player exits a Vehicle.
export async function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle)
{
  let player = FindPlayer(eventPlayer);
  player.isInsideVehicle = false;
}
//#endregion

//#region Game Ended [DONE]
// This will trigger when the gamemode ends.
export async function OnGameModeEnding()
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

  // Increase timers.
  team1ScoreTimer++;
  team2ScoreTimer++;

  // Get bleeding rate based on number of points held for each team.
  let team1Rate = GetTicketsBleedRate(team1PointsHeld, Capture_Points_Ids.length);
  let team2Rate = GetTicketsBleedRate(team2PointsHeld, Capture_Points_Ids.length);

  // If both teams are equal then there is no bleeding.
  if(team1PointsHeld == team2PointsHeld)
  {
    team1Rate = 0;
    team2Rate = 0;
  }

  if(team1ScoreTimer >= team1Rate && team1Rate > 0)
  {
    // Reset timer.
    team1ScoreTimer = 0;
    // Decrease other teams tickets.
    team_hq2_tickets--;
  }
  if(team2ScoreTimer >= team2Rate && team2Rate > 0)
  {
    // Reset timer.
    team2ScoreTimer = 0;
    // Decrease other teams tickets.
    team_hq1_tickets--;
  }
}
function GetTicketsBleedRate(capturePointsHeld: number, numberOfFlags:number): number
{
  if(capturePointsHeld == 0)
  {
    return 0 ;
  }
  let value = numberOfFlags - capturePointsHeld + 1;
  return value;
}
function UpdateScoreBoard()
{
  const numberOfPlayers = Players.playersList.length;
  // Update tickets counters.
  mod.SetScoreboardHeader(mod.Message(mod.stringkeys.teamtickets, team_hq1_tickets), mod.Message(mod.stringkeys.teamtickets, team_hq2_tickets));
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      // Update player score.
      mod.SetScoreboardPlayerValues(player.player, player.score, player.kills, player.deaths, player.assists, player.flags);
    }
  }
}
//#endregion

//#region Round Status UI [DONE]
function UpdateTimerUIAll()
{
  let timeTotalSeconds = RoundDurationSeconds;
  let timeTotalMinutes = mod.Floor(timeTotalSeconds / 60);
  let timeRemainingSeconds = mod.Floor(timeTotalSeconds - (timeTotalMinutes * 60));
  let timeText = mod.Message(mod.stringkeys.timer, timeTotalMinutes, timeRemainingSeconds);
  if(timeRemainingSeconds >= 10)
  {
    // MM:SS
    timeText = mod.Message(mod.stringkeys.timer, timeTotalMinutes, timeRemainingSeconds);
  }
  else
  {
    // We want time to always MM:SS
    timeText = mod.Message(mod.stringkeys.timer0, timeTotalMinutes, timeRemainingSeconds);
  }
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];    
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      UpdateTimerUIPlayer(player, timeText);
    }
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
      player.roundStatusUI.openRoundStatus(time, Capture_Points_Ids.length);
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
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      if(mod.Equals(player.team, TEAM_HQ1))
      {
        blueTicketsText = FormatTicketUIString(team_hq1_tickets);      
        redTicketsText = FormatTicketUIString(team_hq2_tickets);
        UpdateTicketsUIPlayer(player, blueTicketsText, redTicketsText, team_hq1_tickets, team_hq2_tickets);
      }
      else
      {
        blueTicketsText = FormatTicketUIString(team_hq2_tickets);      
        redTicketsText = FormatTicketUIString(team_hq1_tickets);
        UpdateTicketsUIPlayer(player, blueTicketsText, redTicketsText, team_hq2_tickets, team_hq1_tickets);
      }
    }
  }
}
function FormatTicketUIString(ticketsCount:number):mod.Message
{
  if(ticketsCount >= 100)
  {
    return mod.Message(mod.stringkeys.bluetickets, ticketsCount);
  }
  else if(100 > ticketsCount && ticketsCount >= 10)
  {
    return mod.Message(mod.stringkeys.bluetickets0, ticketsCount);
  }
  else if(10 > ticketsCount)
  {
    return mod.Message(mod.stringkeys.bluetickets00, ticketsCount);
  }
  return mod.Message(mod.stringkeys.bluetickets, ticketsCount);
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
      player.roundStatusUI.openRoundStatus(blueTicketsText, Capture_Points_Ids.length);
    }
    if (player.roundStatusUI.isOpenRoundStatus()) 
    {
      player.roundStatusUI.refreshRedTickets(redTicketsText, redTicketsNumber);
    }
    else
    {
        player.roundStatusUI.openRoundStatus(redTicketsText, Capture_Points_Ids.length);
    }
  }
}
function UpdateAllFlags()
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    // Only for valid players.
    if(mod.IsPlayerValid(player.player))
    {
      UpdateFlagsForPlayer(player); 
    }
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
      player.roundStatusUI.openRoundStatus(mod.Message('Hello'), flags.length);
    }
  }
}
function UpdateCapturePointStatusUIPlayer(player:PlayerClass)
{
  // Only for human players.
  if(!player.isAISoldier)
  {
    // Get current capture progress.
    let progress = mod.GetCaptureProgress(player.currentCapturePoint);

    // Get team owner.
    let team = mod.GetOwnerProgressTeam(player.currentCapturePoint);    
    
    // Get blue team count inside capture flag.
    let blueCount = GetTeamFlagCount(TEAM_HQ1, player.currentCapturePoint);
    // Get read team count inside capture flag.
    let redCount = GetTeamFlagCount(TEAM_HQ2, player.currentCapturePoint);

    // Switch between blue and red.
    if(mod.Equals(player.team, TEAM_HQ1))
    {
      blueCount = GetTeamFlagCount(TEAM_HQ1, player.currentCapturePoint);
      redCount = GetTeamFlagCount(TEAM_HQ2, player.currentCapturePoint);    
    }
    else
    {
      blueCount = GetTeamFlagCount(TEAM_HQ2, player.currentCapturePoint);
      redCount = GetTeamFlagCount(TEAM_HQ1, player.currentCapturePoint); 
    }

    // Get capture flag label.
    //let captureLabel = mod.Message(mod.stringkeys.A);
    let captureLabel = player.currentCapturePointLabel;
    
    // Update UI.
    if (player.roundStatusUI.isOpenCapturePointStatus())
    {
      // Add 2 progress bar. one for the count blue vs red and one for the capture progress.
      if(mod.Equals(team,player.team))
      {
        player.roundStatusUI.refreshCapturePointStatus(captureLabel, progress, blueCount, redCount, 1);
      }
      else
      {
        player.roundStatusUI.refreshCapturePointStatus(captureLabel, progress, blueCount, redCount, 2);
      }
    }
    else
    {
      player.roundStatusUI.openCapturePointStatus(captureLabel, progress, blueCount, redCount);
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
function GetCapturePointLabel(capturePoint: mod.CapturePoint):mod.Message
{
  // Get the Capture point Id.
  let id = mod.GetObjId(capturePoint);
  // Get index.
  const flagsCount = CaptureFlags.flagsList.length;
  for(let i = 0; i < flagsCount; i++)
  {
    if(mod.Equals(id, CaptureFlags.flagsList[i].captureFlagId))
    {
      // Return Label.
      return CaptureFlags.flagsList[i].captureFlagLabel;
    }
  }
  // Create Label.
  let empty = mod.Message(mod.stringkeys.A);
  // Return Label.
  return empty;
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
  let capturePointsIds = [];
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
  return mod.RoundToInteger(GetRandomNumber(min,max));
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

//#region Display Notifications [DONE]
function UpdatePlayerPositionDebug()
{
  if(!DEBUG)
  {
    return;
  }  
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
  mod.DisplayCustomNotificationMessage(exampleMessage, mod.CustomNotificationSlots.MessageText1, 1);
}
//#endregion

//#region DEBUG
function LogFunctionDebug(message:string, code:number)
{
  if(DEBUG)
  {
    console.log(message);
    switch(true)
    {
      case 0<=code && code<10000:
        if(DEBUG_00000)
        {
          LogFunctionDebugAllPlayers(message, code);
        }
        break;
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
function MessageDebugAllPlayers(debugLine: number, ...params: any[])
{
  const numberOfPlayers = Players.playersList.length;  
  for (let i = 0; i < numberOfPlayers; i++) 
  {
    const player = Players.playersList[i];
    // Only for valid players.
    if(!mod.IsPlayerValid(player.player))
    {
      continue;
    }
    switch(params.length)
    {
      case 1:
        if(typeof params[0] === "number")
        {
          let message1 = mod.Message(mod.stringkeys.debuglog1v, params[0] as number);
          MessageDebugPlayerUI(debugLine, player, message1);
        }
        else if (typeof params[0] === "string")
        {
          //mod.stringkeys.debuglogstring = params[0] as string;
          let message11 = mod.Message(mod.stringkeys.debuglogstring2, params[0] as string);
          MessageDebugPlayerUI(debugLine, player, message11);
        }        
        break;
      case 2:
        let message2 = mod.Message(mod.stringkeys.debuglog2v, params[0] as number, params[1] as number);
        MessageDebugPlayerUI(debugLine, player, message2);
        break;
      case 3:
        let message3 = mod.Message(mod.stringkeys.debuglog3v, params[0] as number, params[1] as number, params[2] as number);
        MessageDebugPlayerUI(debugLine, player, message3);
        break;
    }
  }
}
function MessageDebugPlayerUI(debugLine: number, player: PlayerClass, message: mod.Message)
{
  if(player.isAISoldier)
  {
    return;
  }
  if (player.debugUI.isOpen()) 
  {
    player.debugUI.refreshLog(debugLine, message);
  }
  else
  {
    player.debugUI.open(debugLine, message);
  }
}
// JSON: "debuglogstring": "log v1:{v1}"
function format(template: string, vars: Record<string, any>)
{
  return template.replace(/{(\w+)}/g, (_, k) => String(vars[k] ?? ""));
}

//#endregion

//#region UI Classes
class MessageDebugUI
{
    #jsPlayer;
    #rootWidget: mod.UIWidget|undefined;

    #containerWidth = 500;
    #containerHeight = 200;
    #lineBreakHeight = 3;
    #backgroundSpacing = 4;
    #activeTabBgColor = [0, 0, 0];
    
    #debugTextList: mod.UIWidget[];
    #debugConsoleLines: string[];

    #isUIVisible = false;

    constructor(jsPlayer: PlayerClass)
    {
      this.#debugTextList = [];
      this.#debugConsoleLines = [];
      this.#jsPlayer = jsPlayer;
    }

    open(debugLine:number, message: mod.Message)
    {
        console.log("Open message UI");
        if (!this.#rootWidget)
        {
          this.#create(message);
        }
        else 
        {
          this.refreshLog(debugLine, message);
          if (this.#debugTextList && debugLine < this.#debugTextList.length)
          {
            mod.SetUITextColor(this.#debugTextList[debugLine], mod.CreateVector(WHITECOLOR[0], WHITECOLOR[1], WHITECOLOR[2]));
          }
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

    refreshLog(debugLine:number, message: mod.Message) 
    {
        if (!this.#debugTextList)
        {
            return;
        }
        if(debugLine < this.#debugTextList.length)
        {
          mod.SetUITextLabel(this.#debugTextList[debugLine], message);
        }        
    }
    refreshConsole(message: mod.Message) 
    {
        if (!this.#debugTextList)
        {
            return;
        }
        for(let i = 0; i < this.#debugTextList.length - 1; i++)
        {
          // Take current message.
          let msg = this.#debugConsoleLines[i + 1];        
          
          // Copy message to next line.
          mod.SetUITextLabel(this.#debugTextList[i + 1], mod.Message(''));
        }
        // Write new line.
        mod.SetUITextLabel(this.#debugTextList[0], message);
    }

    #create(message: mod.Message)
    {
      this.#containerHeight = NOFDEBUGLINES * 20;
        // background:
        this.#rootWidget = ParseUI({
            type: "Container",
            size: [this.#containerWidth, this.#containerHeight],
            position: [0, 0],
            anchor: mod.UIAnchor.TopRight,
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
        for (let i = 0; i < NOFDEBUGLINES; i++) 
        {     
          // Empty flag.
          const textContainer = ParseFlagLabelUI({
              type: "Text",
              parent: this.#rootWidget,
              textSize: 18,
              position: [0, 20 * i , 0],
              size: [this.#containerWidth, 20],
              anchor: mod.UIAnchor.TopLeft,
              textAnchor: mod.UIAnchor.CenterLeft,
              bgAlpha: 0,
              textColor: WHITECOLOR,
              //bgColor: [1, 0, 0],
              textLabel: message,
          });
          this.#debugTextList.push(textContainer);
        }
    }
}
class RoundStatusUI
{
    #jsPlayer;
    #rootRoundStatusWidget: mod.UIWidget|undefined;
    

    // We want the status UI like this
    //    85     85      85    255
    // -----------------------
    // | A B C D E F G H I J | 30
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

    // Flags.
    #capturePoints : mod.UIWidget[];
    #capturePointsLabels : mod.UIWidget[];
    // Timer.
    #timer: mod.UIWidget|undefined;
    #blueTickets: mod.UIWidget|undefined;
    #redTickets: mod.UIWidget|undefined;
    #blueTicketsProgressBar: mod.UIWidget|undefined;
    #blueTicketsProgressBarBackground: mod.UIWidget|undefined;
    #redTicketsProgressBar: mod.UIWidget|undefined;
    #redTicketsProgressBarBackground: mod.UIWidget|undefined;    

    #isRoundStatusUIVisible = false;

    // We want the capture status UI like this
    //    30    195      30    255
    // -----------------------
    // |        flag         | 30
    // |     capture bar     | 10
    // | Blue   vsBar   Red  | 30
    // -----------------------
    //                         70
    #captureStatusScreenXPosition = 0;
    #captureStatusScreenYPosition = 45;
    #captureStatusContainerWidth = 255;
    #captureStatusContainerHeight = 70;
    #rootCapturePointStatusWidget: mod.UIWidget|undefined;
    
    #flagCaptureLabelWidth = this.#captureStatusContainerWidth;
    #flagCaptureLabelHeight = 30;
    #flagCaptureLabel: mod.UIWidget|undefined;

    #flagCaptureProgressBarWidth = this.#captureStatusContainerWidth;
    #flagCaptureProgressBarHeight = 10;
    #flagCaptureProgressBar: mod.UIWidget|undefined;
    #flagCaptureProgressBarDark: mod.UIWidget|undefined;
    
    #captureStatusBlue: mod.UIWidget|undefined;
    #teamCountBarWidth = 195;
    #blueCountProgressBar: mod.UIWidget|undefined;
    #captureStatusRed: mod.UIWidget|undefined;
    #redCountProgressBar: mod.UIWidget|undefined;
    #isCapturePointStatusUIVisible = false;

    

    constructor(jsPlayer: PlayerClass)
    {
        this.#jsPlayer = jsPlayer;
        // Add flags
        this.#capturePoints = [];
        this.#capturePointsLabels = [];
    }

    //#region Open Close IsOpen
    openRoundStatus(message: mod.Message, numberOfFlags: number)
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
            this.#createCaptureFlagsContainers(numberOfFlags);
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
            let temp : number[];
            temp = [];
            for(let i = 0; i < numberOfFlags; i++)
            {
              // Add empty flags.
              temp.push(0);
            }
            this.refreshCapturePoints(temp);
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
    openCapturePointStatus(capturePointLabel: mod.Message, progress:number, blueCount: number, redCount: number)
    {
        console.log("Open message UI");
        if (!this.#rootCapturePointStatusWidget)
        {
            this.#createCapturePointStatusContainer();
            this.#createCaptureStatus(capturePointLabel);
        }
        else
        {            
            this.refreshCapturePointStatus(capturePointLabel, progress, blueCount, redCount, 1);
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
    refreshCapturePointStatus(capturePointLabel: mod.Message, progress:number, blueCount: number, redCount: number, teamNumber: number)
    {
        console.log("refresh message text with ", );
        
        // Flag Label.
        if (!this.#flagCaptureLabel)
        {
            console.log("Missing Message Text!");
            return;
        } 
        mod.SetUITextLabel(this.#flagCaptureLabel, capturePointLabel);
        
        // Capture progress.
        if (this.#flagCaptureProgressBar)
        {
          // Update progress bar.
          mod.SetUIWidgetSize(this.#flagCaptureProgressBar, mod.CreateVector(progress * this.#flagCaptureProgressBarWidth, this.#flagCaptureProgressBarHeight, 1));
          
          // Update colors
          if(teamNumber == 1)
          {
            mod.SetUIWidgetBgColor(this.#flagCaptureProgressBar, mod.CreateVector(BLUETEAMCOLOR[0], BLUETEAMCOLOR[1], BLUETEAMCOLOR[2]));
          }
          else
          {
            mod.SetUIWidgetBgColor(this.#flagCaptureProgressBar, mod.CreateVector(REDTEAMCOLOR[0], REDTEAMCOLOR[1], REDTEAMCOLOR[2]));
          }
        }
        // Capture statuc color.
        if (this.#flagCaptureProgressBarDark)
        {
          // Update colors
          if(teamNumber == 1)
          {
            mod.SetUIWidgetBgColor(this.#flagCaptureProgressBarDark, mod.CreateVector(BLUETEAMCOLORDARK[0], BLUETEAMCOLORDARK[1], BLUETEAMCOLORDARK[2]));
          }
          else
          {
            mod.SetUIWidgetBgColor(this.#flagCaptureProgressBarDark, mod.CreateVector(REDTEAMCOLORDARK[0], REDTEAMCOLORDARK[1], REDTEAMCOLORDARK[2]));
          }
        }
        
        // Contestant
        if (!this.#captureStatusBlue)
        {
            console.log("Missing Message Text!");
            return;
        }
        // Blue count.
        let messageBlue = mod.Message(mod.stringkeys.capturestatusblue, blueCount);        
        mod.SetUITextLabel(this.#captureStatusBlue, messageBlue);
        if (this.#blueCountProgressBar)
        {          
          // Blue bar.
          let widthBlue = blueCount / (blueCount + redCount);
          mod.SetUIWidgetSize(this.#blueCountProgressBar, mod.CreateVector(widthBlue * this.#teamCountBarWidth, this.#flagCaptureProgressBarHeight, 1));
        }
        if (!this.#captureStatusRed)
        {
            console.log("Missing Message Text!");
            return;
        }
        // Red count.
        let messageRed = mod.Message(mod.stringkeys.capturestatusred, redCount);
        mod.SetUITextLabel(this.#captureStatusRed, messageRed);
        if (this.#redCountProgressBar)
        {
          // Red bar.
          let widthRed = redCount / (blueCount + redCount);
          mod.SetUIWidgetSize(this.#redCountProgressBar, mod.CreateVector(widthRed * this.#teamCountBarWidth, this.#flagCaptureProgressBarHeight, 1));
        }
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
    #createCapturePointStatusContainer()
    {
        // background:
        this.#rootCapturePointStatusWidget = ParseUI({
            type: "Container",
            size: [this.#captureStatusContainerWidth, this.#captureStatusContainerHeight],
            position: [this.#captureStatusScreenXPosition, this.#captureStatusScreenYPosition],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.#activeTabBgColor,
            bgAlpha: 1,
            playerId: this.#jsPlayer.player,
            children: [{
                // Black Background
                type: "Container",
                position: [0, 0],
                size: [this.#captureStatusContainerWidth - this.#backgroundSpacing, this.#captureStatusContainerHeight - this.#backgroundSpacing],
                anchor: mod.UIAnchor.Center,
                bgFill: mod.UIBgFill.Blur,
                bgColor: BLACKCOLOR,
                bgAlpha: 1,
            },
        ]});
    }
    #createCaptureStatus(message: mod.Message)
    {
        // Capture Label, Row 0
        this.#flagCaptureLabel = ParseUI({
            type: "Text",
            parent: this.#rootCapturePointStatusWidget,
            textSize: 28,
            position: [0, 0, 0],
            size: [this.#flagCaptureLabelWidth, this.#flagCaptureLabelHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.Center,
            bgAlpha: 0,
            textColor: BLUETEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
        // Capture Progress bar Dark, Row 1
        this.#flagCaptureProgressBarDark = ParseUI({
            type: "Container",
            parent: this.#rootCapturePointStatusWidget,
            size: [this.#captureStatusContainerWidth, this.#flagCaptureProgressBarHeight],
            position: [0, 30],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: BLUETEAMCOLORDARK,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Capture Progress bar, Row 1
        this.#flagCaptureProgressBar = ParseUI({
            type: "Container",
            parent: this.#rootCapturePointStatusWidget,
            size: [this.#captureStatusContainerWidth, this.#flagCaptureProgressBarHeight],
            position: [0, 30],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: BLUETEAMCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Blue team count, Row 2
        this.#captureStatusBlue = ParseUI({
            type: "Text",
            parent: this.#rootCapturePointStatusWidget,
            textSize: 28,
            position: [0, 40, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.TopLeft,
            textAnchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0,
            textColor: BLUETEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
        });
        // Blue team bar, Row 2
        this.#blueCountProgressBar = ParseUI({
            type: "Container",
            parent: this.#rootCapturePointStatusWidget,
            size: [this.#teamCountBarWidth, this.#flagCaptureProgressBarHeight],
            position: [30, 50],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: BLUETEAMCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Red team bar, Row 2
        this.#redCountProgressBar = ParseUI({
            type: "Container",
            parent: this.#rootCapturePointStatusWidget,
            size: [this.#teamCountBarWidth, this.#flagCaptureProgressBarHeight],
            position: [30, 50],
            anchor: mod.UIAnchor.TopRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: REDTEAMCOLOR,
            bgAlpha: FILLCOLORSALPHA,
        });
        // Red team count, Row 2
        this.#captureStatusRed = ParseUI({
            type: "Text",
            parent: this.#rootCapturePointStatusWidget,
            textSize: 28,
            position: [0, 40, 0],
            size: [this.#colWidth, this.#rowHeight],
            anchor: mod.UIAnchor.TopRight,
            textAnchor: mod.UIAnchor.CenterRight,
            bgAlpha: 0,
            textColor: REDTEAMCOLOR,
            //bgColor: [1, 0, 0],
            textLabel: message,
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