import sys
import face_recognition

def compare_faces(known_image_path, unknown_image_path):
    try:
        # Load the known image (registered face)
        known_image = face_recognition.load_image_file(known_image_path)
        known_encodings = face_recognition.face_encodings(known_image)

        if len(known_encodings) == 0:
            print("error: No face found in registered image")
            return

        known_encoding = known_encodings[0]

        # Load the unknown image (attendance selfie)
        unknown_image = face_recognition.load_image_file(unknown_image_path)
        unknown_encodings = face_recognition.face_encodings(unknown_image)

        if len(unknown_encodings) == 0:
            print("error: No face found in verification image")
            return

        unknown_encoding = unknown_encodings[0]

        # Compare faces
        # tolerance=0.6 is the default. Lower is stricter.
        results = face_recognition.compare_faces([known_encoding], unknown_encoding, tolerance=0.5)

        if results[0]:
            print("true")
        else:
            print("false")

    except Exception as e:
        print(f"error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("error: usage: python face_matcher.py <known_path> <unknown_path>")
        sys.exit(1)
    
    compare_faces(sys.argv[1], sys.argv[2])
