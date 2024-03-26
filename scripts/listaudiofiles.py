import os
audiotypes = ["wav", "flac", "mp3", "ogg"]
 
for file in os.listdir():
    if any(file.endswith(audiotype) for audiotype in audiotypes):
        print(file)

input()