import os

# 1. Konfigurasion ti main folder (Ayan dagiti folders ti eksena)
SCENE_DIR = r"C:\Users\rebeq\Documents\GRAFICAS WEB\assets\scene"

# 2. Dagiti texturas
TEXTURE_MAP = {
    "city": "texture.png",
    "nature": "texture.png",
    "lanterns": "texture.png"
}

# Dagiti lugan nga agusar iti cars-0.png
CAR_MODELS = ['schoolbus', 'car', 'taxi', 'police', 'ambulance', 'firefighter']

def fix_mtl_files():
    fixed_count = 0
    print("Mangrugin a mangsukimat kadagiti .mtl files...\n")
    
    for root, dirs, files in os.walk(SCENE_DIR):
        for file in files:
            if file.endswith(".mtl"):
                filepath = os.path.join(root, file)
                folder_name = os.path.basename(root) # kasla: "city", "nature"
                
                # Ammuen ti nagan ti modelo (awanan .mtl)
                model_name = file.replace('.mtl', '')
                
                # Pilien ti husto a textura (cars-0.png para kadagiti lugan)
                if model_name in CAR_MODELS:
                    texture_name = "cars-0.png"
                else:
                    texture_name = TEXTURE_MAP.get(folder_name, "texture.png")
                    
                texture_line = f"map_Kd ../../textures/{texture_name}\n"
                
                # Basaen ti file
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                has_map_kd = any(line.strip().startswith("map_Kd") for line in lines)
                modified = False
                new_lines = []
                
                for line in lines:
                    # Sukatan ti Kd 0.8 iti Kd 1.0 tapno saan a nasipnget
                    if line.startswith("Kd ") and "0.800000" in line:
                        new_lines.append("Kd 1.000000 1.000000 1.000000\n")
                        modified = True
                    # Sukatan ti absolute path wenno dadduma pay a textura
                    elif line.strip().startswith("map_Kd"):
                        if line.strip() != texture_line.strip():
                            new_lines.append(texture_line)
                            modified = True
                        else:
                            new_lines.append(line)
                    else:
                        new_lines.append(line)
                        
                # Ikabil ti textura no awan
                if not has_map_kd:
                    if new_lines and not new_lines[-1].endswith('\n'):
                        new_lines[-1] += '\n'
                    new_lines.append(texture_line)
                    modified = True
                    
                # I-save ti file no adda nasukatan
                if modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    fixed_count += 1
                    
                    rel_path = os.path.relpath(filepath, SCENE_DIR)
                    print(f"[OK] Nasimpa: {rel_path} -> Nai-link ti '{texture_name}'")

    print(f"\nNalpasen! Adda {fixed_count} a .mtl files ti automatiko a natarimaan.")

if __name__ == "__main__":
    fix_mtl_files()