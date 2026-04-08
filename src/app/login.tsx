import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (email && password) {
      router.replace("/");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <View style={styles.linkContainer}>
        <Text style={styles.linkLabel}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Register</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push("/")} style={styles.backLink}>
        <Text style={styles.backLinkText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  linkContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "center",
  },
  linkLabel: {
    color: "#666",
    fontSize: 14,
  },
  linkText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  backLink: {
    marginTop: 20,
    alignItems: "center",
  },
  backLinkText: {
    color: "#007AFF",
    fontSize: 14,
  },
});
