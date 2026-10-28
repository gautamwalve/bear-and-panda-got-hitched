#!/usr/bin/env python3
"""Generate small, polished 3D GLB mascot models for the wedding page."""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT = "."
COLORS = {
    "bear": (0.66, 0.40, 0.26, 1),
    "bear_light": (0.78, 0.53, 0.37, 1),
    "bear_dark": (0.24, 0.14, 0.11, 1),
    "cream": (0.98, 0.86, 0.73, 1),
    "white": (0.97, 0.96, 0.92, 1),
    "panda_black": (0.15, 0.12, 0.12, 1),
    "blush": (0.97, 0.50, 0.55, 1),
    "eye": (0.07, 0.045, 0.04, 1),
    "highlight": (1, 0.98, 0.9, 1),
    "pink": (0.93, 0.35, 0.48, 1),
    "gold": (0.82, 0.61, 0.25, 1),
}
MATERIALS = {
    name: PBRMaterial(
        name=name,
        baseColorFactor=[int(c * 255) for c in rgba],
        metallicFactor=0.0,
        roughnessFactor=0.52 if name in ("eye", "panda_black") else 0.68,
    )
    for name, rgba in COLORS.items()
}
SPHERE = trimesh.creation.icosphere(subdivisions=2, radius=1.0)


def ellipsoid(name, color, center, scale, rotation_z=0):
    mesh = SPHERE.copy()
    mesh.apply_scale(scale)
    if rotation_z:
        mesh.apply_transform(
            trimesh.transformations.rotation_matrix(rotation_z, [0, 0, 1])
        )
    mesh.apply_translation(center)
    mesh.visual.material = MATERIALS[color]
    mesh.metadata["name"] = name
    return mesh


def segment(name, color, a, b, radius):
    a, b = np.array(a, float), np.array(b, float)
    vector = b - a
    mesh = trimesh.creation.cylinder(
        radius=radius, height=float(np.linalg.norm(vector)), sections=10
    )
    mesh.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], vector))
    mesh.apply_translation((a + b) / 2)
    mesh.visual.material = MATERIALS[color]
    mesh.metadata["name"] = name
    return mesh


def create_mascot(kind):
    panda = kind == "bubu"
    body = "white" if panda else "bear"
    head = "white" if panda else "bear_light"
    ear = "panda_black" if panda else "bear_dark"
    paw = "panda_black" if panda else "bear"
    parts = [
        ellipsoid("Body", body, (0, .48, 0), (.29, .34, .24)),
        ellipsoid("Leg_L", body, (-.16, .20, .015), (.14, .17, .17), -.30),
        ellipsoid("Leg_R", body, (.17, .19, .035), (.14, .16, .17), .32),
        ellipsoid("Foot_L", paw, (-.18, .105, .095), (.145, .075, .17), -.20),
        ellipsoid("Foot_R", paw, (.19, .11, .09), (.15, .075, .17), .18),
        ellipsoid("Arm_L", body, (-.32, .54, .035), (.12, .235, .13), -.62),
        ellipsoid("Arm_R", body, (.31, .58, .045), (.12, .22, .13), .60),
        ellipsoid("Hand_L", paw, (-.42, .69, .12), (.095, .09, .10)),
        ellipsoid("Hand_R", paw, (.40, .70, .12), (.095, .09, .10)),
        ellipsoid("Head", head, (0, .99, .015), (.42, .405, .34)),
    ]
    for x, label in [(-.285, "L"), (.285, "R")]:
        parts.append(ellipsoid("Ear_" + label, ear, (x, 1.295, -.015), (.15, .16, .12)))
        inner = "panda_black" if panda else "cream"
        parts.append(ellipsoid("InnerEar_" + label, inner, (x, 1.30, .081), (.075, .082, .05)))

    if panda:
        parts += [
            ellipsoid("EyePatch_L", "panda_black", (-.16, 1.035, .294), (.095, .135, .055), -.27),
            ellipsoid("EyePatch_R", "panda_black", (.16, 1.035, .294), (.095, .135, .055), .27),
            ellipsoid("Eye_L", "eye", (-.15, 1.04, .343), (.030, .034, .024)),
            ellipsoid("Eye_R", "eye", (.15, 1.04, .343), (.030, .034, .024)),
            ellipsoid("Muzzle", "white", (0, .92, .325), (.145, .105, .07)),
        ]
    else:
        parts += [
            ellipsoid("Eye_L", "eye", (-.15, 1.065, .329), (.026, .032, .025)),
            ellipsoid("Eye_R", "eye", (.15, 1.065, .329), (.026, .032, .025)),
            ellipsoid("Muzzle", "cream", (0, .93, .322), (.16, .105, .075)),
        ]
    parts += [
        ellipsoid("Cheek_L", "blush", (-.255, .945, .287), (.066, .045, .027)),
        ellipsoid("Cheek_R", "blush", (.255, .945, .287), (.066, .045, .027)),
        ellipsoid("Nose", "eye", (0, .945, .405), (.036, .027, .022)),
        segment("Smile_L", "eye", (0, .919, .398), (-.035, .89, .398), .009),
        segment("Smile_R", "eye", (0, .919, .398), (.035, .89, .398), .009),
    ]
    if panda:
        parts.append(ellipsoid("Flower_Core", "gold", (.285, 1.235, .105), (.027, .027, .02)))
        for dx, dy in [(0, .04), (.04, 0), (-.04, 0), (0, -.04)]:
            parts.append(ellipsoid("Flower_Petal", "pink", (.285 + dx, 1.235 + dy, .105), (.027, .026, .016)))

    grouped = {}
    for part in parts:
        grouped.setdefault(part.visual.material.name, []).append(part)
    scene = trimesh.Scene()
    for mat_name, meshes in grouped.items():
        merged = trimesh.util.concatenate(meshes)
        merged.visual.material = MATERIALS[mat_name]
        scene.add_geometry(merged, geom_name=mat_name, node_name=mat_name)
    path = os.path.join(OUT, kind + "-3d.glb")
    scene.export(path, file_type="glb")
    print("Created", path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    create_mascot("dudu")
    create_mascot("bubu")
