import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')  # Change if needed
django.setup()

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

def delete_folder_and_self():
    folder = input("🗑️ Enter folder path to delete the folder and all its contents (e.g., project-docs/reports): ").strip().rstrip('/')

    try:
        dirs, files = default_storage.listdir(folder)

        # Delete all files in the folder
        for file in files:
            file_path = f"{folder}/{file}"
            default_storage.delete(file_path)
            print(f"✅ Deleted file: {file_path}")

        # Recursively delete subfolders and their contents
        for subdir in dirs:
            subfolder_path = f"{folder}/{subdir}"
            # Recursively call this function for subfolders
            delete_folder_and_self_helper(subfolder_path)

        # Optionally, try to delete the folder itself if your storage backend supports it
        print(f"✅ Folder '{folder}' and all its contents have been deleted.")
    except Exception as e:
        print("❌ Error deleting folder and its contents:", e)

def delete_folder_and_self_helper(folder):
    try:
        dirs, files = default_storage.listdir(folder)
        for file in files:
            file_path = f"{folder}/{file}"
            default_storage.delete(file_path)
        for subdir in dirs:
            subfolder_path = f"{folder}/{subdir}"
            delete_folder_and_self_helper(subfolder_path)
    except Exception:
        pass


def upload_file():
    folder = input("📁 Enter folder path (e.g., project-docs/reports): ").strip().rstrip('/')
    filename = input("📝 Enter file name (e.g., report.txt): ").strip()
    content = input("📄 Enter file content: ")

    full_path = f"{folder}/{filename}"

    if default_storage.exists(full_path):
        print("⚠️ File already exists. Replacing it...")
        default_storage.delete(full_path)

    saved_path = default_storage.save(full_path, ContentFile(content.encode()))
    file_url = default_storage.url(saved_path)

    print("✅ File uploaded successfully!")
    print("📁 S3 Key:", saved_path)
    print("🌍 URL:", file_url)


def delete_file():
    full_path = input("🗑️ Enter full file path to delete (e.g., project-docs/reports/report.txt): ").strip()

    if default_storage.exists(full_path):
        default_storage.delete(full_path)
        print("✅ File deleted successfully.")
    else:
        print("❌ File does not exist.")


def delete_folder():
    folder = input("🗑️ Enter folder path to delete all files inside (e.g., project-docs/reports): ").strip().rstrip('/')

    try:
        dirs, files = default_storage.listdir(folder)

        if not files and not dirs:
            print("📂 Folder is empty or does not exist.")
            return

        for file in files:
            file_path = f"{folder}/{file}"
            default_storage.delete(file_path)
            print(f"✅ Deleted file: {file_path}")

        print("✅ All files in the folder have been deleted.")
    except Exception as e:
        print("❌ Error deleting folder contents:", e)


def main():
    print("🚀 S3 File Manager via Django Storage")
    while True:
        print("\nOptions:")
        print("1️⃣  Upload file to folder")
        print("2️⃣  Delete a specific file")
        print("3️⃣  Delete all files in a folder")
        print("4️⃣  Delete a folder and all its contents (recursive)")
        print("5️⃣  Exit")

        choice = input("Enter your choice (1-5): ").strip()

        if choice == "1":
            upload_file()
        elif choice == "2":
            delete_file()
        elif choice == "3":
            delete_folder()
        elif choice == "4":
            delete_folder_and_self()
        elif choice == "5":
            print("👋 Exiting.")
            break
        else:
            print("❌ Invalid choice. Try again.")


if __name__ == "__main__":
    main()
