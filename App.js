import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

// TheSportsDB - ücretsiz, kayıt gerektirmez
const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';

// Takip edilen ligler (id: TheSportsDB league id)
const LEAGUES = [
  { id: 4339, name: 'Super Lig', flag: '🇹🇷' },
  { id: 4328, name: 'Premier Lig', flag: '🏴' },
  { id: 4335, name: 'La Liga', flag: '🇪🇸' },
  { id: 4331, name: 'Bundesliga', flag: '🇩🇪' },
  { id: 4332, name: 'Serie A', flag: '🇮🇹' },
  { id: 4334, name: 'Ligue 1', flag: '🇫🇷' },
  { id: 4480, name: 'Sampiyonlar Ligi', flag: '🏆' },
  { id: 4481, name: 'Avrupa Ligi', flag: '🏆' },
];

// Lig id -> config eslestirmesi
const LEAGUE_BY_ID = {};
LEAGUES.forEach(l => { LEAGUE_BY_ID[l.id] = l; });

// Guvenli fetch - rate limit veya hata durumunda null doner
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getStatusText(status) {
  if (!status || status === 'Not Started' || status === 'NS') return 'Baslamadi';
  if (status === 'Match Finished' || status === 'FT') return 'Bitti';
  if (status === 'HT' || status === 'Halftime') return 'Devre Arasi';
  if (status === '1H' || status === '2H' || status.includes("'")) return 'Canli';
  return status;
}

function getStatusColor(status) {
  if (!status || status === 'Not Started' || status === 'NS') return '#2196F3';
  if (status === 'Match Finished' || status === 'FT') return '#9E9E9E';
  return '#4CAF50'; // Canlı
}

function isLiveMatch(status) {
  if (!status) return false;
  return status === '1H' || status === '2H' || status === 'HT' ||
    status === 'Halftime' || status.includes("'");
}

function formatTime(match) {
  // Önce strTimestamp'ten yerel saati hesapla
  if (match.strTimestamp) {
    // strTimestamp UTC'dir, sonuna Z ekleyerek bunu belirtiyoruz
    const utcStr = match.strTimestamp.endsWith('Z')
      ? match.strTimestamp
      : match.strTimestamp + 'Z';
    const date = new Date(utcStr);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  // Fallback: strTimeLocal veya strTime
  const timeStr = match.strTimeLocal || match.strTime;
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function MatchCard({ match }) {
  const status = match.strStatus;
  const statusColor = getStatusColor(status);
  const live = isLiveMatch(status);
  const hasScore = match.intHomeScore !== null && match.intAwayScore !== null;

  return (
    <View style={[styles.card, live && styles.cardLive]}>
      {/* Durum Etiketi */}
      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>
          {live ? '● ' : ''}{getStatusText(status)}
        </Text>
      </View>

      {/* Saat */}
      <Text style={styles.matchTime}>{formatTime(match)}</Text>

      {/* Takimlar ve Skor */}
      <View style={styles.teamsContainer}>
        {/* Ev Sahibi */}
        <View style={styles.teamSection}>
          {match.strHomeTeamBadge ? (
            <Image source={{ uri: match.strHomeTeamBadge }} style={styles.teamLogo} />
          ) : (
            <View style={styles.teamLogoPlaceholder} />
          )}
          <Text style={styles.teamName} numberOfLines={2}>{match.strHomeTeam}</Text>
        </View>

        {/* Skor */}
        <View style={styles.scoreSection}>
          {hasScore ? (
            <Text style={[styles.score, live && styles.scoreLive]}>
              {match.intHomeScore}  -  {match.intAwayScore}
            </Text>
          ) : (
            <Text style={styles.vsText}>vs</Text>
          )}
        </View>

        {/* Deplasman */}
        <View style={styles.teamSection}>
          {match.strAwayTeamBadge ? (
            <Image source={{ uri: match.strAwayTeamBadge }} style={styles.teamLogo} />
          ) : (
            <View style={styles.teamLogoPlaceholder} />
          )}
          <Text style={styles.teamName} numberOfLines={2}>{match.strAwayTeam}</Text>
        </View>
      </View>
    </View>
  );
}

function LeagueSection({ league }) {
  return (
    <View style={styles.leagueSection}>
      <View style={styles.leagueHeader}>
        <Text style={styles.leagueFlag}>{league.flag}</Text>
        <Text style={styles.leagueName}>{league.name}</Text>
        <Text style={styles.matchCount}>{league.matches.length} mac</Text>
      </View>
      {league.matches.map((match) => (
        <MatchCard key={match.idEvent} match={match} />
      ))}
    </View>
  );
}

export default function App() {
  const [matchesByLeague, setMatchesByLeague] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);


  const fetchMatches = useCallback(async () => {
    try {
      setError(null);

      // Yerel tarihi al (UTC degil)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const matchMap = {};

      // 1) eventsday - tek istekle hizli sonuc
      const dayData = await safeFetch(
        `${BASE_URL}/eventsday.php?d=${dateStr}&s=Soccer`
      );
      if (dayData?.events) {
        dayData.events.forEach(e => { matchMap[e.idEvent] = e; });
      }

      // 2) Tum ligleri paralel cek (3'erli gruplar halinde - rate limit icin)
      for (let i = 0; i < LEAGUES.length; i += 3) {
        const batch = LEAGUES.slice(i, i + 3);
        const promises = batch.map(async (league) => {
          const [nextData, lastData] = await Promise.all([
            safeFetch(`${BASE_URL}/eventsnextleague.php?id=${league.id}`),
            safeFetch(`${BASE_URL}/eventspastleague.php?id=${league.id}`),
          ]);
          const events = [
            ...(nextData?.events || []),
            ...(lastData?.events || []),
          ];
          events
            .filter(e => e.dateEvent === dateStr)
            .forEach(e => { matchMap[e.idEvent] = e; });
        });
        await Promise.all(promises);
        // Batch arasi kisa bekleme
        if (i + 3 < LEAGUES.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Liglere gore grupla
      const allMatches = Object.values(matchMap);
      const byLeagueId = {};
      allMatches.forEach(e => {
        const lid = e.idLeague;
        if (!byLeagueId[lid]) byLeagueId[lid] = [];
        byLeagueId[lid].push(e);
      });

      const results = [];
      LEAGUES.forEach(l => {
        if (byLeagueId[String(l.id)]) {
          results.push({ ...l, matches: byLeagueId[String(l.id)] });
          delete byLeagueId[String(l.id)];
        }
      });
      Object.entries(byLeagueId).forEach(([id, matches]) => {
        results.push({
          id,
          name: matches[0]?.strLeague || 'Diger',
          flag: '⚽',
          matches,
        });
      });

      setMatchesByLeague(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMatches();
  }, [fetchMatches]);

  const today = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  const leagues = matchesByLeague;

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Maclar yukleniyor...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Baslik */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚽ Canli Skorlar</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Asagi cekerek yeniden deneyin</Text>
          </View>
        ) : leagues.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Bugun mac bulunamadi</Text>
          </View>
        ) : null}

        <FlatList
          data={leagues}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <LeagueSection league={item} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 16,
  },

  // Baslik
  header: {
    backgroundColor: '#16213e',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerDate: {
    fontSize: 14,
    color: '#8a8a9a',
    marginTop: 4,
  },

  // Lig Bolumu
  leagueSection: {
    marginBottom: 8,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  leagueFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
    flex: 1,
  },
  matchCount: {
    fontSize: 12,
    color: '#8a8a9a',
  },

  // Mac Karti
  card: {
    backgroundColor: '#1f2940',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a3a5c',
  },
  cardLive: {
    borderColor: '#4CAF50',
    borderWidth: 1.5,
  },

  // Durum
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  matchTime: {
    textAlign: 'center',
    color: '#8a8a9a',
    fontSize: 12,
    marginBottom: 8,
  },

  // Takimlar
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  teamLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a3a5c',
    marginBottom: 6,
  },
  teamName: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Skor
  scoreSection: {
    paddingHorizontal: 16,
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreLive: {
    color: '#4CAF50',
  },
  vsText: {
    fontSize: 16,
    color: '#8a8a9a',
    fontWeight: '600',
  },

  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },

  // Hata & Bos
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorHint: {
    color: '#8a8a9a',
    fontSize: 13,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: '#8a8a9a',
    fontSize: 16,
  },
});
