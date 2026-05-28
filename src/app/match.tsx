import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Contestant {
  id: number;
  name: string;
  bio: string;
  photoUrl: string;
}

interface ContestantsData {
  seasonInfo: {
    seasonId: number;
    title: string;
    totalContestants: number;
  };
  pools: {
    men: Contestant[];
    women: Contestant[];
  };
}

interface Match {
  maleId: number;
  femaleId: number;
}

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/contestants/active`;

export default function Match() {
  const router = useRouter();
  const [data, setData] = useState<ContestantsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMale, setSelectedMale] = useState<number | null>(null);
  const [selectedFemale, setSelectedFemale] = useState<number | null>(null);
  const [availableMen, setAvailableMen] = useState<Contestant[]>([]);
  const [availableWomen, setAvailableWomen] = useState<Contestant[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailContestant, setDetailContestant] = useState<Contestant | null>(null);
  const [detailGender, setDetailGender] = useState<"men" | "women">("men");
  const [matchesExpanded, setMatchesExpanded] = useState(false);

  useEffect(() => {
    fetchContestants();
  }, []);

  useEffect(() => {
    if (data) {
      updateAvailableCandidates();
    }
  }, [matches, data]);

  const fetchExistingMatches = async (seasonId: number) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/matchings/${seasonId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        if (
          responseData.data &&
          responseData.data.menPicks &&
          responseData.data.womenPicks
        ) {
          const menPicks = responseData.data.menPicks;
          const womenPicks = responseData.data.womenPicks;

          // Convert to Match format - positional matching
          const existingMatches: Match[] = [];
          for (
            let i = 0;
            i < menPicks.length && i < womenPicks.length;
            i++
          ) {
            existingMatches.push({
              maleId: menPicks[i],
              femaleId: womenPicks[i],
            });
          }

          setMatches(existingMatches);
        }
      }
    } catch (error) {
      console.error("Error fetching existing matches:", error);
    }
  };

  const fetchContestants = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        setData(responseData.data);
        setAvailableMen(responseData.data.pools.men);
        setAvailableWomen(responseData.data.pools.women);

        // Fetch existing matches for this season
        await fetchExistingMatches(responseData.data.seasonInfo.seasonId);
      } else {
        Alert.alert("Error", "Failed to fetch contestants");
      }
    } catch (error) {
      console.error("Error fetching contestants:", error);
      Alert.alert(
        "Error",
        "Network error: " + (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const updateAvailableCandidates = () => {
    if (!data) return;

    const matchedMaleIds = matches.map((m) => m.maleId);
    const matchedFemaleIds = matches.map((m) => m.femaleId);

    let available = data.pools.men.filter((m) => !matchedMaleIds.includes(m.id));
    let availableF = data.pools.women.filter((w) => !matchedFemaleIds.includes(w.id));

    // If counts are unequal, remove the extra from the larger pool
    const menCount = available.length;
    const womenCount = availableF.length;

    if (menCount > womenCount) {
      available = available.slice(0, womenCount);
    } else if (womenCount > menCount) {
      availableF = availableF.slice(0, menCount);
    }

    setAvailableMen(available);
    setAvailableWomen(availableF);
  };

  const openDetailModal = (contestant: Contestant, gender: "men" | "women") => {
    setDetailContestant(contestant);
    setDetailGender(gender);
    setDetailModalVisible(true);
  };

  const persistMatches = async (matchesToSubmit: Match[]) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/matchings/1`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          menPicks: matchesToSubmit.map((match) => match.maleId),
          womenPicks: matchesToSubmit.map((match) => match.femaleId),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error("Error saving matches:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to save matches"
      );
      throw error;
    }
  };

  const confirmSelection = async () => {
    if (!detailContestant) return;

    if (detailGender === "men") {
      // Select male - if female is already selected, create match
      if (selectedFemale !== null) {
        const newMatch: Match = {
          maleId: detailContestant.id,
          femaleId: selectedFemale,
        };
        const nextMatches = [...matches, newMatch];
        setMatches(nextMatches);
        await persistMatches(nextMatches);
        setSelectedMale(null);
        setSelectedFemale(null);
      } else {
        // If no female selected, just select the male
        setSelectedMale(detailContestant.id);
      }
    } else {
      // Select female - if male is already selected, create match
      if (selectedMale !== null) {
        const newMatch: Match = {
          maleId: selectedMale,
          femaleId: detailContestant.id,
        };
        const nextMatches = [...matches, newMatch];
        setMatches(nextMatches);
        await persistMatches(nextMatches);
        setSelectedMale(null);
        setSelectedFemale(null);
      } else {
        // If no male selected, just select the female
        setSelectedFemale(detailContestant.id);
      }
    }

    setDetailModalVisible(false);
    setDetailContestant(null);
  };

  const removeMatch = (index: number) => {
    const nextMatches = matches.filter((_, i) => i !== index);
    setMatches(nextMatches);
    void persistMatches(nextMatches);
  };

  const quickMatch = (contestant: Contestant, gender: "men" | "women") => {
    if (gender === "men") {
      // If female is selected, create match immediately
      if (selectedFemale !== null) {
        const newMatch: Match = {
          maleId: contestant.id,
          femaleId: selectedFemale,
        };
        const nextMatches = [...matches, newMatch];
        setMatches(nextMatches);
        void persistMatches(nextMatches);
        setSelectedMale(null);
        setSelectedFemale(null);
      } else {
        // Otherwise just toggle male selection
        setSelectedMale(selectedMale === contestant.id ? null : contestant.id);
      }
    } else {
      // Female clicked
      // If male is selected, create match immediately
      if (selectedMale !== null) {
        const newMatch: Match = {
          maleId: selectedMale,
          femaleId: contestant.id,
        };
        const nextMatches = [...matches, newMatch];
        setMatches(nextMatches);
        void persistMatches(nextMatches);
        setSelectedMale(null);
        setSelectedFemale(null);
      } else {
        // Otherwise just toggle female selection
        setSelectedFemale(selectedFemale === contestant.id ? null : contestant.id);
      }
    }
  };

  const renderContestantCard = (
    contestant: Contestant,
    gender: "men" | "women",
    isSelected?: boolean
  ) => {
    return (
      <View key={contestant.id} style={styles.cardContainer}>
        <TouchableOpacity
          style={[
            styles.card,
            isSelected && styles.cardSelected,
            gender === "men" && isSelected && styles.cardSelectedMale,
          ]}
          onPress={() => openDetailModal(contestant, gender)}
        >
          <Image
            source={{
              uri: contestant.photoUrl || "https://via.placeholder.com/150?text=No+Photo",
            }}
            style={styles.photo}
            onError={() => {
              // Fallback to placeholder
            }}
          />
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{contestant.name}</Text>
            <Text style={styles.bio} numberOfLines={2}>
              {contestant.bio}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓</Text>
            </View>
          )}
          
          {/* Quick Match Heart Button */}
          <TouchableOpacity
            style={styles.quickMatchButton}
            onPress={() => quickMatch(contestant, gender)}
          >
            <Text style={styles.quickMatchButtonText}>♥</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load contestants</Text>
        <TouchableOpacity style={styles.button} onPress={fetchContestants}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.seasonTitle}>{data.seasonInfo.title}</Text>
        </View>

        {/* Collapsible Matched Pairs Display */}
        {matches.length > 0 && (
          <View style={styles.matchesSectionContainer}>
            <TouchableOpacity
              style={styles.matchesSectionHeader}
              onPress={() => setMatchesExpanded(!matchesExpanded)}
              disabled={availableMen.length === 0 && availableWomen.length === 0}
            >
              <Text style={styles.matchesSectionTitle}>
                Matches ({matches.length}) {availableMen.length === 0 && availableWomen.length === 0 ? "▼" : matchesExpanded ? "▼" : "▶"}
              </Text>
            </TouchableOpacity>
            {(matchesExpanded || (availableMen.length === 0 && availableWomen.length === 0)) && (
              <View style={styles.matchesList}>
                {matches.map((match, index) => {
                  const male = data.pools.men.find((m) => m.id === match.maleId);
                  const female = data.pools.women.find((w) => w.id === match.femaleId);
                  return (
                    <View key={index} style={styles.matchPair}>
                      <Text style={styles.matchPairText}>
                        {male?.name} ↔ {female?.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.releaseButton}
                        onPress={() => removeMatch(index)}
                      >
                        <Text style={styles.releaseButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Male Selection */}
        {(availableMen.length > 0 || availableWomen.length > 0) && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Male Candidates {selectedMale && "✓"}
              </Text>
              <Text style={styles.sectionSubtitle}>Available: {availableMen.length}</Text>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                style={styles.carouselContainer}
              >
                {availableMen.map((contestant) =>
                  renderContestantCard(
                    contestant,
                    "men",
                    selectedMale === contestant.id
                  )
                )}
              </ScrollView>
            </View>

            {/* Female Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Female Candidates {selectedFemale && "✓"}</Text>
              <Text style={styles.sectionSubtitle}>Available: {availableWomen.length}</Text>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                style={styles.carouselContainer}
              >
                {availableWomen.map((contestant) =>
                  renderContestantCard(contestant, "women", selectedFemale === contestant.id)
                )}
              </ScrollView>
            </View>
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              (availableMen.length > 0 || availableWomen.length > 0) && styles.buttonDisabled,
            ]}
            onPress={async () => {
              if (matches.length === 0) {
                Alert.alert("No Matches", "Please create at least one match");
                return;
              }
              if (availableMen.length > 0 || availableWomen.length > 0) {
                Alert.alert(
                  "Incomplete Matching",
                  `Please match all candidates. Remaining: ${availableMen.length}M × ${availableWomen.length}F`
                );
                return;
              }

              try {
                await persistMatches(matches);
                Alert.alert(
                  "Matches Saved",
                  `You've created ${matches.length} match${matches.length !== 1 ? "es" : ""}!`
                );
                router.back();
              } catch {
                // Error already surfaced by persistMatches
              }
            }}
            disabled={availableMen.length > 0 || availableWomen.length > 0}
          >
            <Text style={styles.buttonText}>
              {availableMen.length === 0 && availableWomen.length === 0
                ? "Save All Matches"
                : `Complete Matching (${availableMen.length}M ${availableWomen.length}F left)`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {detailContestant && (
              <>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>

                <Image
                  source={{
                    uri: detailContestant.photoUrl || "https://via.placeholder.com/200?text=No+Photo",
                  }}
                  style={styles.detailImage}
                />

                <View style={styles.detailInfo}>
                  <Text style={styles.detailName}>{detailContestant.name}</Text>
                  <Text style={styles.detailBio}>{detailContestant.bio}</Text>
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmSelection}
                >
                  <Text style={styles.confirmButtonText}>♥</Text>
                  <Text style={styles.confirmButtonLabel}>
                    {detailGender === "men"
                      ? "Select this Male"
                      : selectedMale !== null
                      ? "Match with Selected Male"
                      : "Select this Female"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "center",
  },
  seasonTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  matchesSection: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
  },
  matchesSectionContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
    zIndex: 1000,
  },
  matchesSectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
  },
  matchesSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1B5E20",
  },
  matchesList: {
    gap: 6,
    padding: 12,
    paddingTop: 0,
    maxHeight: 400,
  },
  matchPair: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#C8E6C9",
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchPairText: {
    fontSize: 13,
    color: "#1B5E20",
    fontWeight: "500",
    flex: 1,
  },
  releaseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  releaseButtonText: {
    fontSize: 14,
    color: "white",
    fontWeight: "bold",
  },
  section: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#999",
    marginBottom: 8,
  },
  carouselContainer: {
    height: 300,
    alignSelf: "center",
  },
  cardContainer: {
    width: 260,
    height: 280,
    marginHorizontal: 8,
    justifyContent: "center",
  },
  card: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: "#34C759",
  },
  cardSelectedMale: {
    borderColor: "#007AFF",
  },
  photo: {
    flex: 1,
    width: "100%",
    backgroundColor: "#e0e0e0",
  },
  cardInfo: {
    padding: 12,
    backgroundColor: "white",
  },
  name: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 3,
  },
  bio: {
    fontSize: 11,
    color: "#666",
    lineHeight: 14,
  },
  selectedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedBadgeText: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
  },
  quickMatchButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FF1493",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  quickMatchButtonText: {
    fontSize: 24,
    color: "#FF1493",
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
    marginTop: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  submitButton: {
    backgroundColor: "#34C759",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
  },
  detailImage: {
    width: "100%",
    height: 400,
    backgroundColor: "#e0e0e0",
  },
  detailInfo: {
    padding: 20,
    backgroundColor: "white",
  },
  detailName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  detailBio: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#FF1493",
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  confirmButtonText: {
    fontSize: 28,
    color: "white",
  },
  confirmButtonLabel: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
});
