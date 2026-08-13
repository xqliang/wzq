package main

import (
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	log.Println("listening :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
