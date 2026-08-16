# Ported from the caller_agent prototype's asterisk/Dockerfile. Dev-only —
# this has no dialplan/pjsip config baked in beyond a bare AMI listener, just
# enough for the app's dialer engine to hold an AMI connection locally.
# Production Asterisk config (real trunk, dialplan, pjsip) lives on the VPS,
# same as the prototype — not in this repo.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       asterisk \
    && rm -rf /var/lib/apt/lists/*

COPY manager.conf /etc/asterisk/manager.conf
COPY extensions.conf /etc/asterisk/extensions.conf

EXPOSE 5038/tcp
EXPOSE 5060/udp 5060/tcp
EXPOSE 10000-10100/udp

CMD ["asterisk", "-f"]
