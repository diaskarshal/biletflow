import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

// Week 1 scope: prove the camera preview renders on a physical device (WEEK1-PLAN.md #5.4).
// QR decoding + check-in API call is the Week 2 spike.
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>BiletFlow needs camera access to scan ticket QR codes.</Text>
        <Button title="Grant camera permission" onPress={requestPermission} />
      </View>
    );
  }

  if (!showCamera) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission granted.</Text>
        <Button title="Open camera preview" onPress={() => setShowCamera(true)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  text: {
    textAlign: "center",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
});
