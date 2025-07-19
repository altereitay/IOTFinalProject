import RPi.GPIO as GPIO
import time

# GPIO setup
TRIG = 17
ECHO = 27

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

def get_distance():
    # Send trigger pulse
    GPIO.output(TRIG, False)
    time.sleep(0.0002)
    GPIO.output(TRIG, True)
    time.sleep(0.00001)  # 10µs pulse
    GPIO.output(TRIG, False)

    # Wait for echo start
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()

    # Wait for echo end
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()

    pulse_duration = pulse_end - pulse_start
    distance_cm = pulse_duration * 17150  # speed of sound

    return round(distance_cm, 2)

try:
    while True:
        dist = get_distance()
        print(f"Distance: {dist} cm", flush=True)
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()