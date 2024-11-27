import { DisplayValueHeader, Color } from 'pixel_combats/basic';
import { Players, Inventory, Teams, Ui, Properties, GameMode, Spawns, LeaderBoard, BuildBlocksSet, BreackGraph, Damage, Timers, Game, TeamsBalancer, NewGame, NewGameVote } from 'pixel_combats/room';

// Константы:
var WaitingPlayersTime = 11;
var BuildBaseTime = 31;
var GameModeTime = 601;
var EndOfMatchTime = 11;
var MockModeTime = 20;
var VoteTime = 20;

// Константы, имён:
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfMatchStateValue = "EndOfMatch";
var MockModeStateValue = "MockMode";

// Постоянные - переменные:
var MainTimer = Timers.GetContext().Get("Main");
var StateProp = Properties.GetContext().Get("State");

// Применяем параметры, создания - комнаты:
Damage.FriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// Блок игрока, всегда - усилен:
BreackGraph.PlayerBlockBoost = true;

// Параметры, игры:
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// Стандартные, команды:
Teams.Add("Blue", "<b><i><color=Blue>[Синия]-|команда</a></i></b>", new Color(0, 0, 1, 0));
Teams.Add("Red", "<b><i><color=Red>[Красная]-|команда</a><i></b>", new Color(1, 0, 0, 0));
var BlueTeam = Teams.Get("Blue");
var RedTeam = Teams.Get("Red");
BlueTeam.Spawns.SpawnPointsGroups.Add(1);
RedTeam.Spawns.SpawnPointsGroups.Add(2);
BlueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
RedTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// Максимальные - смерти, команд:
var MaxDeaths = Players.MaxCount * 5;
Teams.Get("Red").Properties.Get("Deaths").Value = MaxDeaths;
Teams.Get("Blue").Properties.Get("Deaths").Value = MaxDeaths;
// Стандартные - лидерБорды:
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "<b><color=Yellow>Убийства:</a></b>",
		ShortDisplayName: "<b><color=Yellow>Убийства:</a></b>"
	},
	{
		Value: "Deaths",
		DisplayName: "<b><color=Red>Смерти:</a></b>",
		ShortDisplayName: "<b><color=Red>Смерти:</a></b>"
	},
	{
		Value: "Spawns",
		DisplayName: "<b><color=Blue>Спавны:</a></b>",
		ShortDisplayName: "<b><color=Blue>Спавны:</a></b>"
	},
	{
		Value: "Scores",
		DisplayName: "<b><color=Lime>Очки:</a></b>",
		ShortDisplayName: "<b><color=Lime>Очки:</a></b>"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: "Deaths",
	DisplayName: "Statistics\Deaths",
	ShortDisplayName: "Statistics\Deaths"
};
// Вес - команды, в лидерБорде:
LeaderBoard.TeamWeightGetter.Set(function(Team) {
	return Team.Properties.Get("Deaths").Value;
});
// Вес - игрока, в лидерБорде:
LeaderBoard.PlayersWeightGetter.Set(function(Player) {
	return Player.Properties.Get("Kills").Value;
});

// Задаём, что выводить, в табе:
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: "Deaths" };

// Задаём, зайти игроку - в команду:
Teams.OnRequestJoinTeam.Add(function(Player,Team){Team.Add(Player);});
// Задаём, заспавнится игроку - в команду: 
Teams.OnPlayerChangeTeam.Add(function(Player){ Player.Spawns.Spawn()});

// Делаем игроков, неуязвимыми - после спавна:
var immortalityTimerName="immortality";
Spawns.GetContext().OnSpawn.Add(function(Player){
	Player.Properties.Immortality.Value=true;
	timer=Player.Timers.Get(immortalityTimerName).Restart(5);
});
Timers.OnPlayerTimer.Add(function(Timer){
	if(Timer.Id!=immortalityTimerName) return;
	Timer.Player.Properties.Immortality.Value=false;
});

// После каждой - смерти игрока, отнимаем одну - смерть, в команде:
Properties.OnPlayerProperty.Add(function(Context, Value) {
	if (Value.Name !== "Deaths") return;
	if (Context.Player.Team == null) return;
	Context.Player.Team.Properties.Get("Deaths").Value--;
});
// Если у игрока - занулилились смерти, то завершаем игру:
Properties.OnTeamProperty.Add(function(context, value) {
	if (value.Name !== "Deaths") return;
	if (value.Value <= 0) SetEndOfMatchMode();
});

// Счётчик - спавнов:
Spawns.OnSpawn.Add(function(Player) {
	++Player.Properties.Spawns.Value;
});
// Счётчик - смертей:
Damage.OnDeath.Add(function(Player) {
	++Player.Properties.Deaths.Value;
});
// Счётчик - убийствов:
Damage.OnKill.Add(function(Player, Killed) {
	if (Killed.Team != null && Killed.Team != Player.Team) {
		++Player.Properties.Kills.Value;
		Player.Properties.Scores.Value += 100;
	}
});

// Переключение - игровых, режимов:
MainTimer.OnTimer.Add(function() {
	switch (StateProp.Value) {
	case WaitingStateValue:
		SetBuildMode();
		break;
	case BuildModeStateValue:
		SetGameMode();
		break;
	case GameStateValue:
		SetEndOfMatchMode();
		break;
	case EndOfMatchStateValue:
		RestartGame();
		break;
	}
});

// Задаём, первое игровое - состояние игры:
SetWaitingMode();

// Состояние, игры:
function SetWaitingMode() {
	StateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Ожидание, игроков...";
	Spawns.GetContext().Enable = false;
	Spawns.GetContext().Despawn();
	MainTimer.Restart(WaitingPlayersTime);
}

function SetBuildMode() 
{
	StateProp.Value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "!Застраивайте базу - и атакуйте, врагов!";
	var Inventory = Inventory.GetContext();
	Inventory.Main.Value = false;
	Inventory.Secondary.Value = false;
	Inventory.Melee.Value = true;
	Inventory.Explosive.Value = false;
	Inventory.Build.Value = true;

	MainTimer.Restart(BuildBaseTime);
	Spawns.GetContext().Enable = true;
        Spawns.GetContext().Spawn();
	SpawnTeams();
}
function SetGameMode() 
{
	StateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "!Атакуйте, врагов!";

	var Inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		Inventory.Main.Value = false;
		Inventory.Secondary.Value = false;
		Inventory.Melee.Value = true;
		Inventory.Explosive.Value = false;
		Inventory.Build.Value = true;
	} else {
		Inventory.Main.Value = true;
		Inventory.Secondary.Value = true;
		Inventory.Melee.Value = true;
		Inventory.Explosive.Value = true;
		Inventory.Build.Value = true;
	}

	MainTimer.Restart(GameModeTime);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
function SetEndOfMatchMode() {
	StateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "!Конец, матча!";

	var Spawns = Spawns.GetContext();
	Spawns.Enable = false;
	Spawns.Despawn();
	Game.GameOver(LeaderBoard.GetTeams());
	MainTimer.Restart(EndOfMatchTime);	
}
function OnVoteResult(Value) {
	if (Value.Result === null) return;
	NewGame.RestartGame(Value.Result);
}
NewGameVote.OnResult.Add(OnVoteResult); // вынесено из функции, которая выполняется только на сервере, чтобы не зависало, если не отработает, также чтобы не давало баг, если вызван метод 2 раза и появилось 2 подписки:

function start_vote() {
	NewGameVote.Start({
		Variants: [{ MapId: 0 }],
		Timer: VoteTime
	}, MapRotation ? 3 : 0);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	var Spawns = Teams.Spawn();
	 Spawns.GetContext().Spawn();
	    SpawnTeams();
		
	}
}

