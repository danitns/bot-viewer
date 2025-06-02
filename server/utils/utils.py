import math

def quaternion_from_euler(roll, pitch, yaw):
    """
    Convert Euler angles to a quaternion.
    
    Args:
        roll (float): Roll angle in radians
        pitch (float): Pitch angle in radians
        yaw (float): Yaw angle in radians
        
    Returns:
        tuple: Quaternion as (x, y, z, w)
    """
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)
    
    qx = sr * cp * cy - cr * sp * sy
    qy = cr * sp * cy + sr * cp * sy
    qz = cr * cp * sy - sr * sp * cy
    qw = cr * cp * cy + sr * sp * sy
    
    return (qx, qy, qz, qw)