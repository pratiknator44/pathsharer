import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface UserData {
  userId: string;
  isActive: boolean;
  source: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  updatedAt: string;
}

function getRelativeTime(dateString: string) {
  if (!dateString) return '';
  const diffInSeconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (diffInSeconds < 60) return "Just Now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}mins ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function PotentialCopassengersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { users, sourceName, destName } = useLocalSearchParams<{
    users: string;
    sourceName: string;
    destName: string;
  }>();

  let parsedUsers: UserData[] = [];
  try {
    if (users) {
      parsedUsers = JSON.parse(users);
    }
  } catch (err) {
    console.error("Failed to parse users", err);
  }

  const bg = colors.background;
  const textColor = colors.text;
  const iconColor = colors.icon;
  const cardBg = colorScheme === 'dark' ? '#1e1e1e' : '#ffffff';
  const border = colorScheme === 'dark' ? '#333' : '#eee';

  const renderItem = ({ item }: { item: UserData }) => (
    <View style={[styles.userCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.userTitleRow}>
        <Text style={[styles.userTitle, { color: textColor }]}>Passenger ID: {item.userId.substring(0, 8)}...</Text>
        <Text style={styles.timeText}>{getRelativeTime(item.updatedAt)}</Text>
      </View>
      <View style={styles.locationRow}>
        <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
        <Text style={[styles.locationText, { color: iconColor }]} numberOfLines={1}>
          From: {item.source?.name}
        </Text>
      </View>
      
      <View style={styles.locationRow}>
        <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
        <Text style={[styles.locationText, { color: iconColor }]} numberOfLines={1}>
          To: {item.destination?.name}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.connectButton, { backgroundColor: colors.tint }]}
        activeOpacity={0.8}
      >
        <Text style={styles.connectText}>Connect</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Potential Co-passengers</Text>
      </View>

      <View style={styles.routeContainer}>
        <Text style={[styles.routeLabel, { color: textColor }]}>Your Route:</Text>
        <Text style={[styles.routeText, { color: iconColor }]}>
          <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>From: </Text>{sourceName}
        </Text>
        <Text style={[styles.routeText, { color: iconColor }]}>
          <Text style={{ color: '#F44336', fontWeight: 'bold' }}>To: </Text>{destName}
        </Text>
      </View>

      <FlatList
        data={parsedUsers}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: iconColor }]}>No potential co-passengers found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  routeContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  routeText: {
    fontSize: 15,
    marginBottom: 4,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  connectButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
