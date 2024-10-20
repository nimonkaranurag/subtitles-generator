curl -X POST -F 'video=@/home/nimotoofly/subtitle-generator-backend/videos/vid1.mp4' http://localhost:8080/upload
docker run -d -p 8080:8080 -v /home/nimotoofly/subtitle-generator-backend/subtitle-generator-439201-227fcad98028.json:/app/subtitle-generator-439201-227fcad98028.json subtitle-generator
